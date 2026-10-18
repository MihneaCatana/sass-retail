-- Bootstrap databases for the dev stack.
-- The ${POSTGRES_DB} (retail) database is created automatically by the postgres image,
-- so here we only create the Keycloak database.

CREATE DATABASE keycloak;
