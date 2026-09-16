/**
 * Step definitions for features/passkeys.feature — registering adds a
 * login, a passkey signs in without a password, and the list is per person.
 * The WebAuthn ceremonies themselves belong to Better Auth and the browser;
 * these steps drive the port with the in-memory authenticator.
 */

import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import { featurePath } from '@glib-glub/testing';
import { expect } from 'vitest';

import { fakeAssertion, fakeAttestation, identityWorld, type IdentityWorld } from './testing';

const feature = await loadFeature(featurePath(import.meta.url, 'passkeys.feature'));

describeFeature(feature, ({ Scenario, BeforeEachScenario }) => {
  let world: IdentityWorld;
  BeforeEachScenario(() => {
    world = identityWorld();
  });

  const signsUp = async (_ctx: unknown, email: string, password: string) => {
    await world.signUp(email, password);
  };
  const isSignedIn = (_ctx: unknown, email: string) => {
    expect(world.sessionOf.has(email)).toBe(true);
  };
  const registers = async (_ctx: unknown, email: string, name: string) => {
    world.last = await world.authenticator.registerPasskey({
      session: world.signedIn(email),
      name,
      attestation: fakeAttestation(),
    });
    expect(world.last.ok).toBe(true);
  };
  const hasPasskey = async (_ctx: unknown, email: string, name: string) => {
    const passkeys = await world.store.listPasskeys(await world.userIdOf(email));
    expect(passkeys.ok && passkeys.val.map((p) => p.name)).toContain(name);
  };

  Scenario('Registering a passkey adds a login', ({ Given, When, Then, And }) => {
    Given('{string} signed up with the password {string}', signsUp);
    And('{string} is signed in', isSignedIn);
    When('she registers a passkey named {string}', (ctx: unknown, name: string) =>
      registers(ctx, 'maya@example.com', name)
    );
    Then('{string} has a passkey named {string}', hasPasskey);
  });

  Scenario('A passkey signs in without a password', ({ Given, When, Then, And }) => {
    Given('{string} signed up with the password {string}', signsUp);
    And('{string} registered a passkey named {string}', registers);
    When(
      '{string} signs in with the passkey {string}',
      async (_ctx: unknown, email: string, name: string) => {
        world.sessionOf.delete(email);
        const passkeys = await world.store.listPasskeys(await world.userIdOf(email));
        const passkey = passkeys.ok ? passkeys.val.find((p) => p.name === name) : undefined;
        const session = await world.authenticator.signInWithPasskey({
          credentialId: passkey?.credentialId ?? 'missing',
          assertion: fakeAssertion(),
        });
        world.last = session;
        if (session.ok) world.sessionOf.set(email, session.val);
      }
    );
    Then('a session exists for {string}', (_ctx: unknown, email: string) => {
      expect(world.sessionOf.has(email)).toBe(true);
    });
  });

  Scenario(
    'The passkey list belongs to the signed-in person only',
    ({ Given, When, Then, And }) => {
      let listed: string[] = [];
      Given('{string} signed up with the password {string}', signsUp);
      And('{string} signed up with the password {string}', signsUp);
      And('{string} registered a passkey named {string}', registers);
      When('{string} lists their passkeys', async (_ctx: unknown, email: string) => {
        const passkeys = await world.store.listPasskeys(await world.userIdOf(email));
        listed = passkeys.ok ? passkeys.val.map((p) => p.name ?? '') : ['error'];
      });
      Then('the list is empty', () => {
        expect(listed).toEqual([]);
      });
    }
  );
});
