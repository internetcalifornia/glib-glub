/**
 * Step definitions for features/config.feature — the loader's promises in
 * the operator's words: a complete environment loads, a missing or malformed
 * variable is named, absent provider credentials disable the provider, and
 * the fake-server flag is honoured.
 *
 * vitest-cucumber insists every step a scenario contains is defined and
 * every step defined is contained, so each scenario binds exactly its own
 * lines; the shared behaviour lives in the small helpers above them.
 */

import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import type { Result } from '@campfhir/safe-functions/types';
import { featurePath } from '@glib-glub/testing';
import { expect } from 'vitest';

import {
  databaseEnvSchema,
  loadEnv,
  socialProvidersOf,
  voiceGatewayEnvSchema,
  webEnvSchema,
} from './env';
import type { EnvSource, VoiceGatewayEnv, WebEnv } from './env';
import type { ConfigErrorTag } from './errors';

const feature = await loadFeature(featurePath(import.meta.url, 'config.feature'));

describeFeature(feature, ({ Scenario, BeforeEachScenario }) => {
  let source: EnvSource;
  let outcome: Result<unknown, ConfigErrorTag>;

  BeforeEachScenario(() => {
    source = {};
  });

  const set = (_ctx: unknown, name: string, value: string): void => {
    source[name] = value;
  };
  const unset = (_ctx: unknown, name: string): void => {
    delete source[name];
  };
  const expectSuccess = (): void => {
    expect(outcome.ok).toBe(true);
  };
  const expectInvalidEnv = (): void => {
    expect(!outcome.ok && outcome.err.type).toBe('INVALID_ENV');
  };
  const expectMentions = (_ctx: unknown, name: string): void => {
    expect(!outcome.ok && outcome.err.message).toContain(name);
  };
  /** Web and gateway schemas need a database URL the scenarios do not mention. */
  const withDatabase = (): EnvSource => ({ DATABASE_URL: 'postgres://x', ...source });
  /** The gateway also needs the ticket secret it shares with the web app. */
  const withGatewaySecret = (): EnvSource => ({
    AUTH_SECRET: '0123456789abcdef0123456789abcdef',
    ...withDatabase(),
  });

  Scenario('A complete environment loads', ({ Given, When, Then, And }) => {
    Given('the environment sets {word} to {string}', set);
    When('the database configuration is loaded', () => {
      outcome = loadEnv(databaseEnvSchema, source);
    });
    Then('loading succeeds', expectSuccess);
    And('the database URL is {string}', (_ctx: unknown, url: string) => {
      expect(outcome.ok && outcome.val).toEqual({ DATABASE_URL: url });
    });
  });

  Scenario('A missing required variable is named in the failure', ({ Given, When, Then, And }) => {
    Given('the environment does not set {word}', unset);
    When('the database configuration is loaded', () => {
      outcome = loadEnv(databaseEnvSchema, source);
    });
    Then('loading fails with INVALID_ENV', expectInvalidEnv);
    And('the failure message mentions {string}', expectMentions);
  });

  Scenario('A malformed variable is named in the failure', ({ Given, When, Then, And }) => {
    Given('the environment sets {word} to {string}', set);
    And('the environment sets {word} to {string}', set);
    When('the web configuration is loaded', () => {
      outcome = loadEnv(webEnvSchema, withDatabase());
    });
    Then('loading fails with INVALID_ENV', expectInvalidEnv);
    And('the failure message mentions {string}', expectMentions);
  });

  Scenario(
    'Optional providers are disabled when their credentials are absent',
    ({ Given, When, Then, And }) => {
      let web: Result<WebEnv, ConfigErrorTag>;
      Given('the environment sets {word} to {string}', set);
      And('the environment sets {word} to {string}', set);
      And('the environment does not set {word}', unset);
      When('the web configuration is loaded', () => {
        web = loadEnv(webEnvSchema, withDatabase());
        outcome = web;
      });
      Then('loading succeeds', expectSuccess);
      And('the google provider is disabled', () => {
        expect(web.ok && socialProvidersOf(web.val).google).toBeNull();
      });
    }
  );

  Scenario(
    'The fake Voice Live flag turns on the in-process server',
    ({ Given, When, Then, And }) => {
      let gateway: Result<VoiceGatewayEnv, ConfigErrorTag>;
      Given('the environment sets {word} to {string}', set);
      When('the voice gateway configuration is loaded', () => {
        gateway = loadEnv(voiceGatewayEnvSchema, withGatewaySecret());
        outcome = gateway;
      });
      Then('loading succeeds', expectSuccess);
      And('the gateway uses the fake Voice Live server', () => {
        expect(gateway.ok && gateway.val.VOICE_LIVE_FAKE).toBe(true);
      });
    }
  );
});
