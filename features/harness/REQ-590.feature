Feature: A run as an OpenTelemetry trace

  @REQ-590 @SCN-590a
  Scenario: A run in the team's tracing tool
    Given `OTEL_EXPORTER_OTLP_ENDPOINT=http://collector:4318`
    When a harness run of REQ-000 ends
    Then the collector receives `/v1/traces` with the spans `harness run` and `REQ-000`
