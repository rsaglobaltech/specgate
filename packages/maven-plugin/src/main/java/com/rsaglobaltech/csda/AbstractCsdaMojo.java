package com.rsaglobaltech.csda;

import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import org.apache.maven.plugin.AbstractMojo;
import org.apache.maven.plugin.MojoExecutionException;
import org.apache.maven.plugin.MojoFailureException;
import org.apache.maven.plugins.annotations.Parameter;

/**
 * Shared launcher for every csda goal. Resolves the specgate
 * CLI without requiring the developer to manage a Node.js toolchain:
 *
 * <ul>
 *   <li>{@code -Dcsda.launcher=npx} — run through npx (needs Node &ge; 20)</li>
 *   <li>{@code -Dcsda.launcher=docker} — run the official image with the
 *       project directory mounted at /workspace</li>
 *   <li>{@code -Dcsda.launcher=auto} (default) — npx when available,
 *       docker otherwise</li>
 * </ul>
 */
public abstract class AbstractCsdaMojo extends AbstractMojo {

    /** CLI version to run (npx tag or docker tag). */
    @Parameter(property = "csda.version", defaultValue = "latest")
    protected String cliVersion;

    /** How to launch the CLI: auto | npx | docker. */
    @Parameter(property = "csda.launcher", defaultValue = "auto")
    protected String launcher;

    /** Docker image used by the docker launcher. */
    @Parameter(property = "csda.dockerImage", defaultValue = "ghcr.io/rsaglobaltech/specgate")
    protected String dockerImage;

    /** Directory the CLI operates on (the repo root for multi-module builds). */
    @Parameter(property = "csda.projectDir", defaultValue = "${project.basedir}")
    protected File projectDir;

    /** Arguments for the concrete goal, e.g. ["validate", ".", "--strict"]. */
    protected abstract List<String> cliArgs();

    @Override
    public void execute() throws MojoExecutionException, MojoFailureException {
        List<String> command = buildCommand();
        getLog().info("csda> " + String.join(" ", command));
        try {
            Process process = new ProcessBuilder(command)
                    .directory(projectDir)
                    .inheritIO()
                    .start();
            int exit = process.waitFor();
            if (exit != 0) {
                throw new MojoFailureException(
                        "specgate exited " + exit + " — the spec gate failed. "
                                + "Run `mvn csda:doctor` for a diagnosis with fixes.");
            }
        } catch (IOException e) {
            throw new MojoExecutionException(
                    "Failed to launch specgate: " + e.getMessage(), e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new MojoExecutionException("Interrupted while waiting for specgate", e);
        }
    }

    List<String> buildCommand() throws MojoExecutionException {
        String mode = launcher;
        if ("auto".equals(mode)) {
            if (isOnPath(isWindows() ? "npx.cmd" : "npx")) {
                mode = "npx";
            } else if (isOnPath(isWindows() ? "docker.exe" : "docker")) {
                mode = "docker";
            } else {
                throw new MojoExecutionException(
                        "Neither npx nor docker found on PATH. Install Node.js >= 20 or Docker, "
                                + "or set -Dcsda.launcher=npx|docker explicitly.");
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
                throw new MojoExecutionException(
                        "Unknown csda.launcher: " + mode + " (expected auto, npx, or docker)");
        }
        cmd.addAll(cliArgs());
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
