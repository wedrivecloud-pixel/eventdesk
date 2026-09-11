// Last occupied date. Historical hour packages occupy their start date.
export const eventEndSql = `to_char(x.date::date + (
 COALESCE((SELECT MAX(CASE
 WHEN ed_text(j.value,'$.packageSettings.dateMode')='Date Only'
 AND ed_text(j.value,'$.packageSettings.durationUnit')='Days'
 THEN GREATEST(1,FLOOR(COALESCE(ed_number(j.value,'$.minutes'),ed_number(j.value,'$.packageSettings.includedDays')*1440,1440)/1440))
 + FLOOR((COALESCE(ed_number(j.value,'$.extraMinutes'),0)+1439)/1440)
 ELSE 1 END) FROM ed_each(x.items) j),1)-1)::integer,'YYYY-MM-DD')`;
// Evaluated in a SERIALIZABLE write transaction; retries re-evaluate the guard.
export const capacityConflictSql = `EXISTS (
 SELECT d.value FROM ed_each(?) d JOIN events x ON x.business_id=?
 AND x.status='confirmed' AND x.lifecycle='Active' AND x.id!=?
 AND x.date<=d.value AND ${eventEndSql}>=d.value
 GROUP BY d.value HAVING COUNT(*)>=?
)`;
