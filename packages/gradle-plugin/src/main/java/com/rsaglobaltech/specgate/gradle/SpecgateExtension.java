package com.rsaglobaltech.specgate.gradle;

import java.io.File;

import org.gradle.api.provider.Property;

/**
 * {@code specgate { }} configuration block. Every knob can also be overridden on
 * the command line with the matching {@code -Pspecgate.*} project property.
 *
 * <pre>
 * specgate {
 *   version = '0.1.4'          // pin the CLI version in CI
 *   launcher = 'docker'        // force docker in air-gapped runners
 *   dockerImage = 'registry.internal/specgate'
 *   strictTdd = true
 * }
 * </pre>
 */
public abstract class SpecgateExtension {

    /** CLI version to run (npx tag or docker tag). Default {@code latest}. */
    public abstract Property<String> getVersion();

    /** How to launch the CLI: auto | npx | docker. Default {@code auto}. */
    public abstract Property<String> getLauncher();

    /** Docker image used by the docker launcher. */
    public abstract Property<String> getDockerImage();

    /** Directory the CLI operates on (the repo root for multi-project builds). */
    public abstract Property<File> getProjectDir();

    /** Enforce the strict TDD rules for {@code specgateValidate}. Default {@code true}. */
    public abstract Property<Boolean> getStrictTdd();

    /** Output format for {@code specgatePlan}: text | json. Default {@code text}. */
    public abstract Property<String> getFormat();
}
