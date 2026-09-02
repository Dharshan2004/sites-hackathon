import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const museums = sqliteTable('museums', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  subtitle: text('subtitle').notNull(),
  lens: text('lens').notNull(),
  sourceKey: text('source_key').notNull(),
  renderKey: text('render_key').notNull(),
  exhibitsJson: text('exhibits_json').notNull(),
  createdAt: integer('created_at').notNull(),
});
