package com.rsaglobaltech.specgate.gradle;

import java.util.Arrays;
import java.util.List;

import org.gradle.api.tasks.TaskAction;
import org.gradle.api.tasks.UntrackedTask;

/**
 * {@code gradle specgateDoctor} — full project/environment diagnosis; every
 * finding is reported with a concrete fix.
 */
@UntrackedTask(because = "diagnoses the project and environment, both of which change outside Gradle's knowledge")
public abstract class SpecgateDoctorTask extends SpecgateTask {

    @TaskAction
    public void run() {
        runCli();
    }

    @Override
    protected List<String> cliArgs() {
        return Arrays.asList("doctor", "--project-dir", ".");
    }
}
