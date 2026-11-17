# Application variables for the prod environment.
# WARNING: Replace placeholder values before deploying.
# Inject DATABASE_PASSWORD and DATABASE_URL via CI secrets or a secrets manager.
APP_ENV=prod
PROJECT_SLUG=my-spec-driven-app

DATABASE_ENGINE=postgres
DATABASE_HOST=db
DATABASE_PORT=5434
DATABASE_NAME=my_spec_driven_app_prod
DATABASE_USER=my_spec_driven_app_app
DATABASE_PASSWORD=change-me
DATABASE_URL=postgresql://my_spec_driven_app_app:change-me@db:5432/my_spec_driven_app_prod
