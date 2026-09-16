/**
 * Step definitions for features/uploads.feature — the extract → screen →
 * summarise pipeline and its outcomes, who may upload for whom, and what
 * deleting removes.
 */

import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import { featurePath } from '@glib-glub/testing';
import { expect } from 'vitest';

import { profileWorld, type ProfileWorld } from './testing';
import { deleteUpload, uploadWork } from './uploads';

const feature = await loadFeature(featurePath(import.meta.url, 'uploads.feature'));

const encode = (text: string) => new TextEncoder().encode(text);

describeFeature(feature, ({ Scenario, Background }) => {
  let world: ProfileWorld;

  Background(({ Given }) => {
    Given(
      '{string} is a learner with the age band {string}',
      async (_ctx: unknown, email: string, band: string) => {
        world = profileWorld();
        await world.learner(email, band);
      }
    );
  });

  const isLearner = async (_ctx: unknown, email: string, band: string) => {
    await world.learner(email, band);
  };
  const acceptedGuardian = async (_ctx: unknown, guardian: string, learner: string) => {
    await world.learner(guardian, 'adult');
    void (await world.identity.store.upsertGuardianship({
      guardianId: await world.userIdOf(guardian),
      learnerId: await world.userIdOf(learner),
      status: 'accepted',
    }));
  };
  const uploadsOwn = async (_ctx: unknown, email: string, fileName: string, text: string) => {
    const id = await world.userIdOf(email);
    world.last = await uploadWork(
      world,
      { actorId: id, learnerId: id },
      { fileName, mimeType: 'text/plain', bytes: encode(text) }
    );
  };
  const uploadsFor = async (
    _ctx: unknown,
    actor: string,
    fileName: string,
    learner: string,
    text: string
  ) => {
    world.last = await uploadWork(
      world,
      { actorId: await world.userIdOf(actor), learnerId: await world.userIdOf(learner) },
      { fileName, mimeType: 'text/plain', bytes: encode(text) }
    );
  };
  const uploadOf = async (email: string, fileName: string) => {
    const list = await world.store.listUploads(await world.userIdOf(email));
    return list.ok ? list.val.find((upload) => upload.fileName === fileName) : undefined;
  };
  const hasStatus = async (_ctx: unknown, fileName: string, email: string, status: string) => {
    expect((await uploadOf(email, fileName))?.status).toBe(status);
  };
  const failsWith = (_ctx: unknown, tag: string) => {
    expect(world.last && !world.last.ok && world.last.err?.type).toBe(tag);
  };

  Scenario('An upload is extracted and summarised', ({ When, Then, And }) => {
    When('{string} uploads {string} containing {string}', uploadsOwn);
    Then('the upload {string} of {string} has the status {string}', hasStatus);
    And('its summary mentions {string}', async (_ctx: unknown, word: string) => {
      const upload = await uploadOf('maya@example.com', 'fractions-test.pdf');
      const extraction = upload ? await world.store.getExtraction(upload.id) : undefined;
      expect(extraction?.ok && extraction.val?.summary).toContain(word);
    });
    And('its tags include {string}', async (_ctx: unknown, tag: string) => {
      const upload = await uploadOf('maya@example.com', 'fractions-test.pdf');
      const extraction = upload ? await world.store.getExtraction(upload.id) : undefined;
      expect(extraction?.ok && extraction.val?.tags).toContain(tag);
    });
    And('the file is stored in the blob store', async () => {
      const upload = await uploadOf('maya@example.com', 'fractions-test.pdf');
      expect(world.blobs.keys()).toEqual([upload?.blobKey]);
    });
  });

  Scenario('Unsafe content is rejected and not kept', ({ When, Then, And }) => {
    When('{string} uploads {string} containing {string}', uploadsOwn);
    Then('the upload {string} of {string} has the status {string}', hasStatus);
    And('no text is kept for {string}', async (_ctx: unknown, fileName: string) => {
      const upload = await uploadOf('maya@example.com', fileName);
      const extraction = upload ? await world.store.getExtraction(upload.id) : undefined;
      expect(extraction?.ok && extraction.val).toBeNull();
      expect(world.blobs.keys()).toEqual([]);
    });
  });

  Scenario('A guardian uploads for a young learner', ({ Given, When, Then, And }) => {
    Given('{string} is a learner with the age band {string}', isLearner);
    And('{string} is an accepted guardian of {string}', acceptedGuardian);
    When('{string} uploads {string} for {string} containing {string}', uploadsFor);
    Then('the upload {string} of {string} has the status {string}', hasStatus);
  });

  Scenario('A stranger cannot upload for someone else', ({ Given, When, Then }) => {
    Given('{string} is a learner with the age band {string}', isLearner);
    When('{string} uploads {string} for {string} containing {string}', uploadsFor);
    Then('the change fails with FORBIDDEN', (ctx: unknown) => failsWith(ctx, 'FORBIDDEN'));
  });

  Scenario('Deleting an upload removes the file and the text', ({ Given, When, Then, And }) => {
    Given('{string} uploaded {string} containing {string}', uploadsOwn);
    When(
      '{string} deletes the upload {string}',
      async (_ctx: unknown, email: string, fileName: string) => {
        const id = await world.userIdOf(email);
        const upload = await uploadOf(email, fileName);
        expect(upload).toBeDefined();
        if (upload)
          world.last = await deleteUpload(world, { actorId: id, learnerId: id }, upload.id);
      }
    );
    Then('{string} has {int} uploads', async (_ctx: unknown, email: string, count: number) => {
      const list = await world.store.listUploads(await world.userIdOf(email));
      expect(list.ok && list.val.length).toBe(count);
    });
    And('the blob store is empty', () => {
      expect(world.blobs.keys()).toEqual([]);
    });
  });
});
