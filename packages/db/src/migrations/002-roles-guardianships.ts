/**
 * Our own identity tables beside Better Auth's: roles (a user may hold
 * several), guardianships (invited → accepted → revoked), and per-learner
 * settings — today only the age band, which drives every safety gate in
 * packages/identity/src/age-band.ts. Snake_case, like every table we own.
 */

import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('user_roles')
    .addColumn('user_id', 'uuid', (col) => col.notNull().references('user.id').onDelete('cascade'))
    .addColumn('role', 'text', (col) => col.notNull())
    .addColumn('granted_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addPrimaryKeyConstraint('user_roles_pk', ['user_id', 'role'])
    .addCheckConstraint(
      'user_roles_role_check',
      sql`role in ('learner', 'guardian', 'educator', 'admin')`
    )
    .execute();

  await db.schema
    .createTable('guardianships')
    .addColumn('guardian_id', 'uuid', (col) =>
      col.notNull().references('user.id').onDelete('cascade')
    )
    .addColumn('learner_id', 'uuid', (col) =>
      col.notNull().references('user.id').onDelete('cascade')
    )
    .addColumn('status', 'text', (col) => col.notNull())
    .addColumn('invited_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('accepted_at', 'timestamptz')
    .addPrimaryKeyConstraint('guardianships_pk', ['guardian_id', 'learner_id'])
    .addCheckConstraint(
      'guardianships_status_check',
      sql`status in ('invited', 'accepted', 'revoked')`
    )
    .addCheckConstraint('guardianships_not_self', sql`guardian_id <> learner_id`)
    .execute();
  await db.schema
    .createIndex('guardianships_learner_idx')
    .on('guardianships')
    .column('learner_id')
    .execute();

  await db.schema
    .createTable('learner_settings')
    .addColumn('user_id', 'uuid', (col) =>
      col.primaryKey().references('user.id').onDelete('cascade')
    )
    .addColumn('age_band', 'text')
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addCheckConstraint(
      'learner_settings_age_band_check',
      sql`age_band is null or age_band in ('k-5', '6-8', '9-12', 'university', 'adult')`
    )
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('learner_settings').execute();
  await db.schema.dropTable('guardianships').execute();
  await db.schema.dropTable('user_roles').execute();
}
