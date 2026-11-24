// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Pure helpers for scripts/designer-setup.mjs: read and check the Agentic CX designer files in
// connect/designer/. No AWS calls, unit tested.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Exit conditions of the Santa conversation. The contact flow checks for these values in `outcome`. */
export const EXIT_CONDITIONS = ['DeliverLetter', 'NoConversation'];
/** Values the designer flows may write into the `outcome` context variable. */
export const OUTCOMES = [...EXIT_CONDITIONS, 'Error'];
/** Context variables the contact flow sets before the conversation starts. */
export const INPUT_VARIABLES = ['childName', 'childNotes'];

const read = (dir, file) => JSON.parse(readFileSync(join(dir, file), 'utf8'));

/** Everything in connect/designer/: the application, its flows, guardrails and context variables. */
export function loadDesigner(dir) {
  const files = readdirSync(dir).sort();
  return {
    application: read(dir, 'application.json'),
    contextVariables: read(dir, 'context-variables.json'),
    guardrails: files.filter((f) => /^guardrail-.*\.json$/.test(f)).map((f) => read(dir, f)),
    flows: files.filter((f) => /^flow-.*\.json$/.test(f)).map((f) => read(dir, f)),
  };
}

function generativeJourneys(flow) {
  return Object.values(flow.nodes)
    .map((n) => n.metadata?.generativeJourney)
    .filter(Boolean);
}

function outcomesSet(flow) {
  return Object.values(flow.nodes).flatMap((n) =>
    (n.metadata?.stateModifications ?? []).filter((m) => m.name === 'outcome').map((m) => m.value?.value),
  );
}

/** Problems that would make the designer reject the files or break the contact flow. Empty when all is well. */
export function checkDesigner({ application, contextVariables, guardrails, flows }) {
  const errors = [];
  const flowIds = new Set(flows.map((f) => f.flowId));
  const variables = new Set(contextVariables.map((v) => v.name));
  for (const ref of application.flows) {
    if (!flowIds.has(ref.flowId)) errors.push(`application flow ${ref.flowId} has no flow-*.json file`);
  }
  for (const [kind, ref] of Object.entries(application.settings.defaultFlows ?? {})) {
    if (!flowIds.has(ref.flowId)) errors.push(`default ${kind} flow ${ref.flowId} has no flow-*.json file`);
  }
  const guardrailNames = new Set(guardrails.map((g) => g.name));
  for (const ref of application.settings.guardrails ?? []) {
    if (!guardrailNames.has(ref.name)) errors.push(`application guardrail "${ref.name}" has no guardrail-*.json file`);
  }
  for (const g of guardrails) {
    // The designer rejects rule names with accents or other non-ASCII characters.
    for (const r of g.rules) {
      if (!/^[\x20-\x7e]+$/.test(r.name)) errors.push(`guardrail "${g.name}": rule name "${r.name}" is not plain ASCII`);
      // The designer rejects longer patterns.
      if (r.detection.method === 'regex' && r.detection.pattern.length > 200) errors.push(`guardrail "${g.name}": rule "${r.name}" pattern is over 200 characters`);
    }
  }
  for (const flow of flows) {
    for (const [id, node] of Object.entries(flow.nodes)) {
      if (node.nodeId !== id) errors.push(`${flow.flowId}: node key ${id} differs from its nodeId`);
      for (const child of node.childNodes ?? []) {
        if (!flow.nodes[child.nodeId]) errors.push(`${flow.flowId}: node ${id} points at missing node ${child.nodeId}`);
      }
    }
    for (const v of flow.contextVariables ?? []) {
      if (!variables.has(v.name)) errors.push(`${flow.flowId}: context variable ${v.name} is not in context-variables.json`);
    }
    for (const o of outcomesSet(flow)) {
      if (!OUTCOMES.includes(o)) errors.push(`${flow.flowId}: outcome "${o}" is not one of ${OUTCOMES.join(', ')}`);
    }
    for (const gj of generativeJourneys(flow)) {
      const exits = gj.exitConditions.map((e) => e.name);
      if (exits.join() !== EXIT_CONDITIONS.join()) errors.push(`${flow.flowId}: exit conditions are ${exits.join(', ')}, expected ${EXIT_CONDITIONS.join(', ')}`);
      for (const name of INPUT_VARIABLES) {
        if (!gj.prompt.includes(`{${name}:NLX.Context}`)) errors.push(`${flow.flowId}: the prompt does not use {${name}:NLX.Context}`);
      }
    }
  }
  return errors;
}

/** CreateApplication / UpdateApplication input, with guardrail names replaced by their IDs. */
export function applicationInput(application, guardrailIdsByName) {
  const settings = {
    ...application.settings,
    guardrails: (application.settings.guardrails ?? []).map(({ name }) => {
      const guardrailId = guardrailIdsByName[name];
      if (!guardrailId) throw new Error(`No ID for guardrail "${name}"`);
      return { guardrailId };
    }),
  };
  return { name: application.name, description: application.description, flows: application.flows, settings };
}
