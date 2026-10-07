package com.rsaglobaltech.csda.gradle;

import java.util.ArrayList;
import java.util.List;

import org.gradle.api.provider.Property;
import org.gradle.api.tasks.Input;
import org.gradle.api.tasks.TaskAction;
import org.gradle.api.tasks.options.Option;
import org.gradle.api.tasks.UntrackedTask;

/**
 * {@code gradle csdaValidate} — run the Spec-Driven Development gate.
 * Fails the build when a requirement lacks its feature file, its test
 * artifact, or its traceability row. Wired into {@code check} by the plugin
 * so it also runs on {@code gradle check}/{@code build}.
 */
@UntrackedTask(because = "runs the csda spec gate on every invocation; skipping it on an up-to-date check would let a broken spec tree pass")
public abstract class CsdaValidateTask extends CsdaTask {

    /**
     * Run the gate, {@code validate --strict} — the same gate
     * {@code specgate ci init} generates. {@code false} (or
     * {@code --no-strict-tdd}, the old name) runs the structural checks only.
     */
    @Input
    @Option(option = "no-strict-tdd", description = "Run the structural checks only, not the gate (validate --strict).")
    public abstract Property<Boolean> getStrictTdd();

    @TaskAction
    public void run() {
        runCli();
    }

    @Override
    protected List<String> cliArgs() {
        List<String> args = new ArrayList<>();
        args.add("validate");
        args.add(".");
        if (getStrictTdd().get()) {
            args.add("--strict");
        }
        return args;
    }
}
