import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const museums = sqliteTable('museums', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  subtitle: text('subtitle').notNull(),
  altText: text('alt_text').notNull().default('An isometric miniature museum generated from an uploaded photograph.'),
  lens: text('lens').notNull(),
  sourceKey: text('source_key').notNull(),
  renderKey: text('render_key').notNull(),
  exhibitsJson: text('exhibits_json').notNull(),
  status: text('status').notNull().default('ready'),
  renderResponseId: text('render_response_id'),
  curationResponseId: text('curation_response_id'),
  error: text('error'),
  phaseUpdatedAt: integer('phase_updated_at'),
  createdAt: integer('created_at').notNull(),
});

export const generationLimits = sqliteTable('generation_limits', {
  bucket: text('bucket').primaryKey(),
  count: integer('count').notNull(),
  expiresAt: integer('expires_at').notNull(),
});
