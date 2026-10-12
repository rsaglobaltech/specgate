package com.rsaglobaltech.specgate.gradle;

import java.io.File;
import java.util.List;

import org.gradle.api.DefaultTask;
import org.gradle.api.provider.Property;
import org.gradle.api.tasks.Input;
import org.gradle.api.tasks.Internal;
import org.gradle.api.tasks.UntrackedTask;

/**
 * Base for every specgate task. Holds the launcher-resolution knobs shared by
 * {@code specgateValidate}, {@code specgatePlan} and {@code specgateDoctor}; conventions
 * are seeded by {@link SpecgatePlugin} from the {@code specgate { }} extension and
 * {@code -Pspecgate.*} project properties.
 */
@UntrackedTask(because = "delegates to the specgate CLI, which reads the whole spec tree and writes only to the console")
public abstract class SpecgateTask extends DefaultTask {

    /** CLI version to run (npx tag or docker tag). */
    @Input
    public abstract Property<String> getCliVersion();

    /** How to launch the CLI: auto | npx | docker. */
    @Input
    public abstract Property<String> getLauncher();

    /** Docker image used by the docker launcher. */
    @Input
    public abstract Property<String> getDockerImage();

    /** Directory the CLI operates on (the repo root for multi-project builds). */
    @Internal
    public abstract Property<File> getProjectDir();

    /** Arguments for the concrete task, e.g. ["validate", ".", "--strict"]. */
    protected abstract List<String> cliArgs();

    protected void runCli() {
        SpecgateLauncher.run(
                getLauncher().get(),
                getCliVersion().get(),
                getDockerImage().get(),
                getProjectDir().get(),
                cliArgs());
    }
}
