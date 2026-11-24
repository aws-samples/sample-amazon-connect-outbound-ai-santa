// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { OUTCOMES, applicationInput, checkDesigner, loadDesigner } from './designer-lib.mjs';

const bundle = loadDesigner('connect/designer');
const contactFlow = JSON.parse(readFileSync('connect/santa-flow.template.json', 'utf8'));

describe('connect/designer', () => {
  it('has no problems', () => {
    expect(checkDesigner(bundle)).toEqual([]);
  });
  it('is English only', () => {
    const text = JSON.stringify(bundle);
    expect(text).not.toMatch(/[áéíóúñ¡¿]/);
    expect(bundle.application.settings.languageCodes).toEqual(['en-US']);
    for (const f of bundle.flows) expect(f.languageCodes).toEqual(['en-US']);
  });
  it('matches what the contact flow passes in and checks on the way out', () => {
    const agent = contactFlow.Actions.find((a) => a.Type === 'ConnectParticipantWithAgenticCX');
    expect(Object.keys(agent.Parameters.AgentConfiguration.ContextVariables)).toEqual(['childName', 'childNotes']);
    const outcome = contactFlow.Actions.find((a) => a.Identifier === 'check-outcome');
    expect(outcome.Parameters.ComparisonValue).toBe('$.AgenticCX.ContextVariables.outcome');
    // Every outcome the designer can write has its own branch; Error after a conversation ends the call without a retry.
    const branches = Object.fromEntries(outcome.Transitions.Conditions.map((c) => [c.Condition.Operands[0], c.NextAction]));
    expect(Object.keys(branches)).toEqual(OUTCOMES);
    expect(branches).toEqual({ DeliverLetter: 'lambda-deliver', NoConversation: 'lambda-no-response', Error: 'say-technical-problem' });
    const deliver = contactFlow.Actions.find((a) => a.Identifier === 'lambda-deliver');
    expect(deliver.Parameters.LambdaInvocationAttributes).toMatchObject({
      action: 'deliver',
      wishlist: '$.AgenticCX.ContextVariables.wishlist',
      behaviour: '$.AgenticCX.ContextVariables.behaviour',
      summary: '$.AgenticCX.ContextVariables.summary',
    });
  });
  it('speaks with an English (US) agentic voice and sets the language once', () => {
    const voice = contactFlow.Actions.find((a) => a.Type === 'UpdateContactTextToSpeechVoice');
    expect(voice.Parameters.TextToSpeechEngine).toBe('connect:agentic');
    const language = contactFlow.Actions.filter((a) => a.Type === 'UpdateContactData');
    expect(language.map((a) => a.Parameters.LanguageCode)).toEqual(['en-US']);
    expect(voice.Transitions.NextAction).toBe(language[0].Identifier);
    expect(language[0].Transitions.NextAction).toBe('lambda-start');
  });
  it('keeps the child out of the contact record and the logs', () => {
    expect(contactFlow.Actions.some((a) => a.Type === 'UpdateContactAttributes')).toBe(false);
    expect(contactFlow.Actions.find((a) => a.Type === 'UpdateFlowLoggingBehavior').Parameters.FlowLoggingBehavior).toBe('Disabled');
    expect(contactFlow.Actions.find((a) => a.Type === 'UpdateContactRecordingBehavior').Parameters.RecordingBehavior.RecordedParticipants).toEqual([]);
  });
});

describe('checkDesigner', () => {
  it('reports a renamed exit condition and a missing guardrail', () => {
    const broken = structuredClone(bundle);
    const gj = Object.values(broken.flows[0].nodes).map((n) => n.metadata?.generativeJourney).find(Boolean)
      ?? Object.values(broken.flows[1].nodes).map((n) => n.metadata?.generativeJourney).find(Boolean);
    gj.exitConditions[0].name = 'EntregarCarta';
    broken.guardrails.pop();
    const errors = checkDesigner(broken);
    expect(errors.some((e) => e.includes('exit conditions'))).toBe(true);
    expect(errors.some((e) => e.includes('has no guardrail-*.json file'))).toBe(true);
  });
});

describe('applicationInput', () => {
  it('replaces guardrail names with IDs', () => {
    const ids = Object.fromEntries(bundle.guardrails.map((g, i) => [g.name, `g-${i}`]));
    expect(applicationInput(bundle.application, ids).settings.guardrails).toEqual([{ guardrailId: 'g-0' }, { guardrailId: 'g-1' }]);
    expect(() => applicationInput(bundle.application, {})).toThrow(/No ID for guardrail/);
  });
});
