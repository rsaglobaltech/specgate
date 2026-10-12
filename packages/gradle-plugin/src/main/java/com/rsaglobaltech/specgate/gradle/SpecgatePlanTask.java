package com.rsaglobaltech.specgate.gradle;

import java.util.ArrayList;
import java.util.List;

import org.gradle.api.provider.Property;
import org.gradle.api.tasks.Input;
import org.gradle.api.tasks.TaskAction;
import org.gradle.api.tasks.options.Option;
import org.gradle.api.tasks.UntrackedTask;

/**
 * {@code gradle specgatePlan} — list requirements that still need a test, code,
 * or a status update. Use {@code --format=json} (or {@code -Pspecgate.format=json})
 * for machine output.
 */
@UntrackedTask(because = "reports the current state of the spec tree, which must be recomputed on every invocation")
public abstract class SpecgatePlanTask extends SpecgateTask {

    /** Output format: text (human) or json (agents/CI). */
    @Input
    @Option(option = "format", description = "Output format: text or json.")
    public abstract Property<String> getFormat();

    @TaskAction
    public void run() {
        runCli();
    }

    @Override
    protected List<String> cliArgs() {
        List<String> args = new ArrayList<>();
        args.add("plan");
        args.add("--project-dir");
        args.add(".");
        if ("json".equals(getFormat().get())) {
            args.add("--format");
            args.add("json");
        }
        return args;
    }
}
