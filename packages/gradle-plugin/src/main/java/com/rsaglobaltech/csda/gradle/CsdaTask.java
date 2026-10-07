package com.rsaglobaltech.csda.gradle;

import java.io.File;
import java.util.List;

import org.gradle.api.DefaultTask;
import org.gradle.api.provider.Property;
import org.gradle.api.tasks.Input;
import org.gradle.api.tasks.Internal;
import org.gradle.api.tasks.UntrackedTask;

/**
 * Base for every csda task. Holds the launcher-resolution knobs shared by
 * {@code csdaValidate}, {@code csdaPlan} and {@code csdaDoctor}; conventions
 * are seeded by {@link CsdaPlugin} from the {@code csda { }} extension and
 * {@code -Pcsda.*} project properties.
 */
@UntrackedTask(because = "delegates to the csda CLI, which reads the whole spec tree and writes only to the console")
public abstract class CsdaTask extends DefaultTask {

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
        CsdaLauncher.run(
                getLauncher().get(),
                getCliVersion().get(),
                getDockerImage().get(),
                getProjectDir().get(),
                cliArgs());
    }
}
