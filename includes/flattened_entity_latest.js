module.exports = (params) => {
  return params.dataSchema.forEach(tableSchema => publish(tableSchema.entityTableName + "_latest_" + params.tableSuffix, {
    ...params.defaultConfig,
    type: "table",
    /*dependencies: ["apply_entities_were_not_streamed_yesterday"], */
    assertions: {
      uniqueKey: ["id"],
      nonNull: ["last_streamed_event_occurred_at", "last_streamed_event_type", "id", "created_at", "updated_at"]
    },
    bigquery: {
      partitionBy: "DATE(created_at)"
    },
    description: "The latest version of each entity from the table with the same name in the Apply production database that has been streamed into the events table.",
    columns: {
      last_streamed_event_occurred_at: "Timestamp of the event that we think provided us with the latest version of this entity.",
      last_streamed_event_type: "Event type of the event that we think provided us with the latest version of this entity. Either entity_created, entity_updated, entity_destroyed or entity_imported.",
      id: "UID",
      created_at: "Date this entity was created, according to the latest version of the data received from the database.",
      updated_at: "Date this entity was last updated something in the database, according to the latest version of the data received from the database.",
    }
  }).query(ctx => `SELECT
  *
EXCEPT
  (valid_to, valid_from, event_type),
  valid_from AS last_streamed_event_occurred_at,
  event_type AS last_streamed_event_type
FROM
  ${ctx.ref(tableSchema.entityTableName + "_version_" + params.tableSuffix)}
WHERE
  valid_to IS NULL
`))
}