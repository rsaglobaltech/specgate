package com.rsaglobaltech.specgate.gradle;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.File;
import java.util.Arrays;
import java.util.List;

import org.gradle.api.GradleException;
import org.junit.jupiter.api.Test;

/**
 * The launcher command assembly is the whole contract of the plugin, so it is
 * tested directly — no Gradle runtime needed. Mirrors the Maven plugin's
 * launcher so the two build tools resolve the CLI identically.
 */
class SpecgateLauncherTest {

    private static final File CWD = new File(".").getAbsoluteFile();

    @Test
    void npxCommandPinsTheRequestedVersionAndAppendsArgs() {
        List<String> cmd = SpecgateLauncher.buildCommand(
                "npx", "0.1.4", "ghcr.io/rsaglobaltech/specgate", CWD,
                Arrays.asList("validate", ".", "--strict"));

        // On Windows the command is prefixed with cmd.exe /c; assert on the tail.
        assertTrue(cmd.contains("--yes"));
        assertTrue(cmd.contains("@rsaglobaltech/specgate@0.1.4"));
        assertEquals(Arrays.asList("validate", ".", "--strict"),
                cmd.subList(cmd.size() - 3, cmd.size()));
        assertFalse(cmd.contains("docker"));
    }

    @Test
    void dockerLatestOmitsTheTagAndMountsTheProjectDir() {
        List<String> cmd = SpecgateLauncher.buildCommand(
                "docker", "latest", "ghcr.io/rsaglobaltech/specgate", CWD,
                Arrays.asList("doctor"));

        assertEquals(
                Arrays.asList(
                        "docker", "run", "--rm",
                        "-v", CWD.getAbsolutePath() + ":/workspace",
                        "ghcr.io/rsaglobaltech/specgate",
                        "doctor"),
                cmd);
    }

    @Test
    void dockerPinnedVersionAppendsTheTagToTheImage() {
        List<String> cmd = SpecgateLauncher.buildCommand(
                "docker", "0.1.4", "registry.internal/specgate", CWD,
                Arrays.asList("validate", "."));

        assertTrue(cmd.contains("registry.internal/specgate:0.1.4"));
    }

    @Test
    void unknownLauncherIsRejected() {
        GradleException ex = assertThrows(GradleException.class, () ->
                SpecgateLauncher.buildCommand(
                        "podman", "latest", "img", CWD, Arrays.asList("doctor")));
        assertTrue(ex.getMessage().contains("Unknown specgate.launcher"));
    }
}
