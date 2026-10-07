package com.rsaglobaltech.csda.gradle;

import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import org.gradle.api.GradleException;

/**
 * Shared launcher for every csda task. Resolves the specgate
 * CLI without requiring the developer to manage a Node.js toolchain:
 *
 * <ul>
 *   <li>{@code -Pcsda.launcher=npx} — run through npx (needs Node &ge; 20)</li>
 *   <li>{@code -Pcsda.launcher=docker} — run the official image with the
 *       project directory mounted at /workspace</li>
 *   <li>{@code -Pcsda.launcher=auto} (default) — npx when available,
 *       docker otherwise</li>
 * </ul>
 *
 * <p>Mirrors the launcher in {@code csda-maven-plugin} so both build tools
 * resolve the CLI identically.</p>
 */
final class CsdaLauncher {

    private CsdaLauncher() {
    }

    /**
     * Build and run the CLI command, streaming its output to the console.
     * Throws {@link GradleException} when the CLI exits non-zero so the
     * Gradle build fails.
     */
    static void run(String launcher, String cliVersion, String dockerImage,
                    File projectDir, List<String> cliArgs) {
        List<String> command = buildCommand(launcher, cliVersion, dockerImage, projectDir, cliArgs);
        System.out.println("csda> " + String.join(" ", command));
        try {
            Process process = new ProcessBuilder(command)
                    .directory(projectDir)
                    .inheritIO()
                    .start();
            int exit = process.waitFor();
            if (exit != 0) {
                throw new GradleException(
                        "specgate exited " + exit + " — the spec gate failed. "
                                + "Run `gradle csdaDoctor` for a diagnosis with fixes.");
            }
        } catch (IOException e) {
            throw new GradleException(
                    "Failed to launch specgate: " + e.getMessage(), e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new GradleException("Interrupted while waiting for specgate", e);
        }
    }

    static List<String> buildCommand(String launcher, String cliVersion, String dockerImage,
                                     File projectDir, List<String> cliArgs) {
        String mode = launcher;
        if ("auto".equals(mode)) {
            if (isOnPath(isWindows() ? "npx.cmd" : "npx")) {
                mode = "npx";
            } else if (isOnPath(isWindows() ? "docker.exe" : "docker")) {
                mode = "docker";
            } else {
                throw new GradleException(
                        "Neither npx nor docker found on PATH. Install Node.js >= 20 or Docker, "
                                + "or set -Pcsda.launcher=npx|docker explicitly.");
            }
        }

        List<String> cmd = new ArrayList<>();
        switch (mode) {
            case "npx":
                if (isWindows()) {
                    cmd.addAll(Arrays.asList("cmd.exe", "/c", "npx"));
                } else {
                    cmd.add("npx");
                }
                cmd.add("--yes");
                cmd.add("@rsaglobaltech/specgate@" + cliVersion);
                break;
            case "docker":
                String tag = "latest".equals(cliVersion) ? dockerImage : dockerImage + ":" + cliVersion;
                cmd.addAll(Arrays.asList(
                        "docker", "run", "--rm",
                        "-v", projectDir.getAbsolutePath() + ":/workspace",
                        tag));
                break;
            default:
                throw new GradleException(
                        "Unknown csda.launcher: " + mode + " (expected auto, npx, or docker)");
        }
        cmd.addAll(cliArgs);
        return cmd;
    }

    private static boolean isWindows() {
        return System.getProperty("os.name", "").toLowerCase().contains("win");
    }

    private static boolean isOnPath(String executable) {
        String pathEnv = System.getenv("PATH");
        if (pathEnv == null) {
            return false;
        }
        for (String dir : pathEnv.split(File.pathSeparator)) {
            if (new File(dir, executable).canExecute()) {
                return true;
            }
        }
        return false;
    }
}
