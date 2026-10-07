package com.rsaglobaltech.csda.gradle;

import java.io.File;

import org.gradle.api.Plugin;
import org.gradle.api.Project;
import org.gradle.language.base.plugins.LifecycleBasePlugin;

/**
 * Registers the csda spec gate on a Gradle project — the counterpart of
 * {@code csda-maven-plugin}. Java teams run {@code gradle csdaValidate}
 * (also wired into {@code check}) with no local Node.js: the CLI is resolved
 * through npx or the official Docker image. See {@link CsdaLauncher}.
 *
 * <p>Tasks: {@code csdaValidate}, {@code csdaPlan}, {@code csdaDoctor}.
 * Configure via the {@code csda { }} extension or {@code -Pcsda.*}.</p>
 */
public class CsdaPlugin implements Plugin<Project> {

    static final String GROUP = "csda spec gate";

    @Override
    public void apply(Project project) {
        CsdaExtension ext = project.getExtensions().create("csda", CsdaExtension.class);
        ext.getVersion().convention(stringProp(project, "csda.version", "latest"));
        ext.getLauncher().convention(stringProp(project, "csda.launcher", "auto"));
        ext.getDockerImage().convention(
                stringProp(project, "csda.dockerImage", "ghcr.io/rsaglobaltech/specgate"));
        ext.getProjectDir().convention(fileProp(project, "csda.projectDir", project.getProjectDir()));
        ext.getStrictTdd().convention(boolProp(project, "csda.strictTdd", true));
        ext.getFormat().convention(stringProp(project, "csda.format", "text"));

        project.getTasks().register("csdaValidate", CsdaValidateTask.class, task -> {
            task.setGroup(GROUP);
            task.setDescription("Run the SDD spec gate; fails the build when traceability breaks.");
            wireLauncher(task, ext);
            task.getStrictTdd().convention(ext.getStrictTdd());
        });

        project.getTasks().register("csdaPlan", CsdaPlanTask.class, task -> {
            task.setGroup(GROUP);
            task.setDescription("List requirements still needing a test, code, or status update.");
            wireLauncher(task, ext);
            task.getFormat().convention(ext.getFormat());
        });

        project.getTasks().register("csdaDoctor", CsdaDoctorTask.class, task -> {
            task.setGroup(GROUP);
            task.setDescription("Full project/environment diagnosis with a fix per finding.");
            wireLauncher(task, ext);
        });

        // Fail `gradle check`/`build` when the gate fails, mirroring the Maven
        // plugin's bind to the verify phase.
        project.getPluginManager().withPlugin("lifecycle-base", applied ->
                project.getTasks().named(LifecycleBasePlugin.CHECK_TASK_NAME)
                        .configure(check -> check.dependsOn("csdaValidate")));
    }

    private static void wireLauncher(CsdaTask task, CsdaExtension ext) {
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
