-- Defense in depth: a child cannot refer to a record in another business.
ALTER TABLE events ADD CONSTRAINT events_id_business_unique UNIQUE(id,business_id);
ALTER TABLE packages ADD CONSTRAINT packages_id_business_unique UNIQUE(id,business_id);
ALTER TABLE event_operations ADD CONSTRAINT operations_event_tenant_fk FOREIGN KEY(event_id,business_id) REFERENCES events(id,business_id);
ALTER TABLE payments ADD CONSTRAINT payments_event_tenant_fk FOREIGN KEY(event_id,business_id) REFERENCES events(id,business_id);
ALTER TABLE package_images ADD CONSTRAINT images_package_tenant_fk FOREIGN KEY(package_id,business_id) REFERENCES packages(id,business_id);
CREATE INDEX idx_events_business_date ON events(business_id,date);
CREATE INDEX idx_sales_business_event ON sales_records(business_id,kind,(data::jsonb ->> 'eventId'));
