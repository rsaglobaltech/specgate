package com.rsaglobaltech.specgate.gradle;

import java.io.File;

import org.gradle.api.Plugin;
import org.gradle.api.Project;
import org.gradle.language.base.plugins.LifecycleBasePlugin;

/**
 * Registers the specgate spec gate on a Gradle project — the counterpart of
 * {@code specgate-maven-plugin}. Java teams run {@code gradle specgateValidate}
 * (also wired into {@code check}) with no local Node.js: the CLI is resolved
 * through npx or the official Docker image. See {@link SpecgateLauncher}.
 *
 * <p>Tasks: {@code specgateValidate}, {@code specgatePlan}, {@code specgateDoctor}.
 * Configure via the {@code specgate { }} extension or {@code -Pspecgate.*}.</p>
 */
public class SpecgatePlugin implements Plugin<Project> {

    static final String GROUP = "specgate spec gate";

    @Override
    public void apply(Project project) {
        SpecgateExtension ext = project.getExtensions().create("specgate", SpecgateExtension.class);
        ext.getVersion().convention(stringProp(project, "specgate.version", "latest"));
        ext.getLauncher().convention(stringProp(project, "specgate.launcher", "auto"));
        ext.getDockerImage().convention(
                stringProp(project, "specgate.dockerImage", "ghcr.io/rsaglobaltech/specgate"));
        ext.getProjectDir().convention(fileProp(project, "specgate.projectDir", project.getProjectDir()));
        ext.getStrictTdd().convention(boolProp(project, "specgate.strictTdd", true));
        ext.getFormat().convention(stringProp(project, "specgate.format", "text"));

        project.getTasks().register("specgateValidate", SpecgateValidateTask.class, task -> {
            task.setGroup(GROUP);
            task.setDescription("Run the SDD spec gate; fails the build when traceability breaks.");
            wireLauncher(task, ext);
            task.getStrictTdd().convention(ext.getStrictTdd());
        });

        project.getTasks().register("specgatePlan", SpecgatePlanTask.class, task -> {
            task.setGroup(GROUP);
            task.setDescription("List requirements still needing a test, code, or status update.");
            wireLauncher(task, ext);
            task.getFormat().convention(ext.getFormat());
        });

        project.getTasks().register("specgateDoctor", SpecgateDoctorTask.class, task -> {
            task.setGroup(GROUP);
            task.setDescription("Full project/environment diagnosis with a fix per finding.");
            wireLauncher(task, ext);
        });

        // Fail `gradle check`/`build` when the gate fails, mirroring the Maven
        // plugin's bind to the verify phase.
        project.getPluginManager().withPlugin("lifecycle-base", applied ->
                project.getTasks().named(LifecycleBasePlugin.CHECK_TASK_NAME)
                        .configure(check -> check.dependsOn("specgateValidate")));
    }

    private static void wireLauncher(SpecgateTask task, SpecgateExtension ext) {
        task.getCliVersion().convention(ext.getVersion());
        task.getLauncher().convention(ext.getLauncher());
        task.getDockerImage().convention(ext.getDockerImage());
        task.getProjectDir().convention(ext.getProjectDir());
    }

    private static String stringProp(Project project, String key, String fallback) {
        Object v = project.findProperty(key);
        return v != null ? v.toString() : fallback;
    }

    private static boolean boolProp(Project project, String key, boolean fallback) {
        Object v = project.findProperty(key);
        return v != null ? Boolean.parseBoolean(v.toString()) : fallback;
    }

    private static File fileProp(Project project, String key, File fallback) {
        Object v = project.findProperty(key);
        return v != null ? project.file(v) : fallback;
    }
}
