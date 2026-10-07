package com.rsaglobaltech.csda;

import java.util.ArrayList;
import java.util.List;

import org.apache.maven.plugins.annotations.LifecyclePhase;
import org.apache.maven.plugins.annotations.Mojo;
import org.apache.maven.plugins.annotations.Parameter;

/**
 * {@code mvn csda:validate} — run the Spec-Driven Development gate.
 * Fails the build when a requirement lacks its feature file, its test
 * artifact, or its traceability row. Binds to the verify phase so it can
 * also run as part of {@code mvn verify}.
 */
@Mojo(name = "validate", defaultPhase = LifecyclePhase.VERIFY, threadSafe = true)
public class ValidateMojo extends AbstractCsdaMojo {

    /**
     * Run the gate, {@code validate --strict}: TDD, links, scenarios,
     * requirements and coverage — the same gate {@code specgate ci init}
     * generates. {@code false} runs the structural checks only. The property
     * keeps its old name so existing builds keep their setting.
     */
    @Parameter(property = "csda.strictTdd", defaultValue = "true")
    private boolean strictTdd;

    @Override
    protected List<String> cliArgs() {
        List<String> args = new ArrayList<>();
        args.add("validate");
        args.add(".");
        if (strictTdd) {
            args.add("--strict");
        }
        return args;
    }
}
