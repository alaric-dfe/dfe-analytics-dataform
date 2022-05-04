function publishFlattenedEntityVersionTable(tableSchema, index, dataSchema, ...params) {
  return publish(tableSchema.entityTableName + "_entity_version", {
    ...params.defaultConfig, 
    type: "incremental",
    uniqueKey: ["id", "valid_from"],
    /*dependencies: ["entities_are_up_to_date"], */
    assertions: {
      uniqueKey: ["valid_from", "id"],
      nonNull: ["id", "created_at", "updated_at"],
      rowConditions: [
        'valid_from < valid_to OR valid_to IS NULL'
      ]
    },
    bigquery: {
      partitionBy: "DATE(valid_to)",
      updatePartitionFilter: "valid_to IS NULL"
    },
    description: "Versions of each reference that was in the reference table in the production database from valid_from until just before valid_to.",
    columns: {
      valid_from: "Timestamp from which this version of this entity started to be valid.",
      valid_to: "Timestamp until which this version of this entity was valid.",
      type: "Event type of the event that provided us with this version of this entity. Either entity_created,entity_updated or entity_imported.",
      id: "Hashed (anonymised) version of the ID of this reference from the database.",
      created_at: "Date this reference was first saved in the database, according to the latest version of the data received from the database.",
      updated_at: "Date this reference was last updated in the database, according to the latest version of the data received from the database.",
    }
  }).query(ctx => `SELECT
  valid_from,
  valid_to,
  event_type,
  entity_id AS id,
  ${data_functions.eventDataExtractTimestamp("DATA","created_at")} AS created_at,
  ${data_functions.eventDataExtractTimestamp("DATA","updated_at")} AS updated_at,
  /*${tableSchema.keys.forEach(key => data_functions.eventDataExtract("DATA", key.keyName))};*/
FROM
  ${ctx.ref(params.tableSuffix + "_entity_version")}
WHERE
  entity_name = "references"
  AND (
    valid_to > event_timestamp_checkpoint
    OR valid_to IS NULL
  )`).preOps(ctx => `DECLARE event_timestamp_checkpoint DEFAULT (
        ${ctx.when(ctx.incremental(),`SELECT MAX(valid_to) FROM ${ctx.self()}`,`SELECT TIMESTAMP("2018-01-01")`)}
      )`)
};

module.exports = (params) => {
  return params.dataSchema.forEach(publishFlattenedEntityVersionTable, ...params)
}