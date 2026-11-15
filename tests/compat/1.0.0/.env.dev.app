# Application variables for the dev environment.
# Consumed by the application process (not Docker Compose infrastructure).
# Safe to commit to version control; never put real secrets here.
APP_ENV=dev
PROJECT_SLUG=my-spec-driven-app

DATABASE_ENGINE=postgres
DATABASE_HOST=db
DATABASE_PORT=5432
DATABASE_NAME=my_spec_driven_app_dev
DATABASE_USER=my_spec_driven_app_app
DATABASE_PASSWORD=change-me
DATABASE_URL=postgresql://my_spec_driven_app_app:change-me@db:5432/my_spec_driven_app_dev
