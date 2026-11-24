// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { describe, expect, it } from 'vitest';
import { config, inferenceProfilePrefix } from './config.js';

describe('inferenceProfilePrefix', () => {
  it('maps the deployment Region to the Bedrock cross-Region profile prefix', () => {
    expect(inferenceProfilePrefix('us-east-1')).toBe('us');
    expect(inferenceProfilePrefix('ca-central-1')).toBe('us');
    expect(inferenceProfilePrefix('eu-central-1')).toBe('eu');
    expect(inferenceProfilePrefix('eu-west-2')).toBe('eu');
    expect(inferenceProfilePrefix('ap-southeast-2')).toBe('apac');
    expect(inferenceProfilePrefix('')).toBe('us');
  });
  it('defaults the letter model to Nova Lite in the Region of the tests', () => {
    expect(config.bedrockModelId).toBe('eu.amazon.nova-lite-v1:0');
  });
});
