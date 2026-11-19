# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0
"""Text test of the Santa AI agent: starts a Connect chat on the Santa flow with a synthetic booking and
plays the child's turns from a scenario file. The letter goes to TEST_PARENT_EMAIL (verified in SES sandbox).
English scenarios are in scripts/chat-scenarios/, Spanish ones in scripts/chat-scenarios/es/. Use the folder that
matches the deployed prompt (SANTA_LANGUAGE).

Usage: set -a; . ./.env; set +a; AWS_PROFILE=<profile> TEST_PARENT_EMAIL=you@example.com \
         BOOKINGS_TABLE=<table> python3 scripts/santa-chat-test.py scripts/chat-scenarios/01-normal.json

Needs: pip install boto3 websocket-client. Uses synthetic data only. attempts is set to the maximum so a
missed test never schedules a real call.
"""
import json, os, sys, time, uuid
import boto3, websocket

S = boto3.Session(region_name=os.environ.get("AWS_REGION", "eu-central-1"))
INSTANCE = os.environ["CONNECT_INSTANCE_ID"]
FLOW = os.environ["CONNECT_CONTACT_FLOW_ID"]
TABLE = os.environ["BOOKINGS_TABLE"]  # bookingsTable in amplify_outputs.json
PARENT = os.environ["TEST_PARENT_EMAIL"]

scenario = json.load(open(sys.argv[1], encoding="utf-8"))
# Synthetic phone in the scenario's country. It is never dialled: the test is a chat.
SPANISH = os.path.basename(os.path.dirname(os.path.abspath(sys.argv[1]))) == "es"
TEST_PHONE = "+34600000000" if SPANISH else "+12125550100"
connect, part, ddb = S.client("connect"), S.client("connectparticipant"), S.client("dynamodb")

booking_id = f"test-chat-{uuid.uuid4().hex[:8]}"
now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
item = {
    "bookingId": {"S": booking_id}, "ownerSub": {"S": "test"}, "childName": {"S": scenario["child"]},
    "notes": {"S": scenario["notes"]}, "parentEmail": {"S": PARENT}, "phoneNumber": {"S": TEST_PHONE},
    "callDate": {"S": "2026-11-16"}, "callTime": {"S": "18:00"}, "callAtUtc": {"S": now}, "status": {"S": "CALLING"},
    "attempts": {"N": "3"}, "createdAt": {"S": now}, "expiresAt": {"N": str(int(time.time()) + 3600)},
}
ddb.put_item(TableName=TABLE, Item=item)

chat = connect.start_chat_contact(
    InstanceId=INSTANCE, ContactFlowId=FLOW, Attributes={"bookingId": booking_id},
    ParticipantDetails={"DisplayName": scenario["child"]},
)
cid = chat["ContactId"]
ddb.update_item(TableName=TABLE, Key={"bookingId": {"S": booking_id}},
                UpdateExpression="SET contactId = :c", ExpressionAttributeValues={":c": {"S": cid}})
conn = part.create_participant_connection(ParticipantToken=chat["ParticipantToken"], Type=["WEBSOCKET", "CONNECTION_CREDENTIALS"])
tok = conn["ConnectionCredentials"]["ConnectionToken"]
# Connect starts the flow once the customer is connected on the websocket.
ws = websocket.create_connection(conn["Websocket"]["Url"])
ws.send(json.dumps({"topic": "aws/subscribe", "content": {"topics": ["aws/chat"]}}))

seen = set()
def bot_lines(wait=25):
    """Wait for new messages from Santa (not the customer) and return them."""
    out, deadline, quiet = [], time.time() + wait, 0
    while time.time() < deadline:
        try:
            tr = part.get_transcript(ConnectionToken=tok, MaxResults=100, SortOrder="ASCENDING")["Transcript"]
        except part.exceptions.AccessDeniedException:
            return out, True  # chat closed by the flow
        ended = False
        for m in tr:
            if m["Id"] in seen: continue
            seen.add(m["Id"])
            if m.get("ParticipantRole") != "CUSTOMER" and m.get("Type") == "MESSAGE":
                out.append(m["Content"])
            if m.get("ContentType", "").endswith("chatended"): ended = True
        if ended: return out, True
        if out:
            quiet += 1
            if quiet >= 2: return out, False
        time.sleep(2)
    return out, False

print(f"== {scenario['name']} (contact {cid})")
# Start of the AI guardrail's blocked messages (connect/agent-guardrail.md), in both languages.
BLOCKED_EN = ("The wind at the North Pole is so loud", "My beard got all tangled up")
BLOCKED_ES = ("Con tanto viento en el Polo Norte", "Se me ha enredado la barba")
BLOCKED = BLOCKED_EN + BLOCKED_ES
def show(lines):
    for l in lines:
        tag = " [GUARDRAIL]" if any(b in l for b in BLOCKED) else ""
        print(f"SANTA{tag}:", l.strip())

lines, ended = bot_lines(30)
show(lines)
for msg in scenario["turns"]:
    if ended: break
    print("CHILD:", msg)
    try:
        part.send_message(ConnectionToken=tok, ContentType="text/plain", Content=msg)
    except part.exceptions.AccessDeniedException:
        ended = True; break
    lines, ended = bot_lines(40)
    show(lines)
print("chat ended:", ended)
time.sleep(8)
b = ddb.get_item(TableName=TABLE, Key={"bookingId": {"S": booking_id}}).get("Item")
print("booking:", "deleted (letter or missed-call email sent)" if not b else {k: list(v.values())[0] for k, v in b.items() if k in ("status", "wishes", "behaviour", "summary")})
if not ended:
    try: connect.stop_contact(InstanceId=INSTANCE, ContactId=cid)
    except Exception as e: print("stop:", e)
if b: ddb.delete_item(TableName=TABLE, Key={"bookingId": {"S": booking_id}})
