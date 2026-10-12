package com.rsaglobaltech.specgate;

import java.util.ArrayList;
import java.util.List;

import org.apache.maven.plugins.annotations.Mojo;
import org.apache.maven.plugins.annotations.Parameter;

/**
 * {@code mvn specgate:plan} — list requirements that still need a test, code,
 * or a status update. Use {@code -Dspecgate.format=json} for machine output.
 */
@Mojo(name = "plan", threadSafe = true)
public class PlanMojo extends AbstractSpecgateMojo {

    /** Output format: text (human) or json (agents/CI). */
    @Parameter(property = "specgate.format", defaultValue = "text")
    private String format;

    @Override
    protected List<String> cliArgs() {
        List<String> args = new ArrayList<>();
        args.add("plan");
        args.add("--project-dir");
        args.add(".");
        if ("json".equals(format)) {
            args.add("--format");
            args.add("json");
        }
        return args;
    }
}
