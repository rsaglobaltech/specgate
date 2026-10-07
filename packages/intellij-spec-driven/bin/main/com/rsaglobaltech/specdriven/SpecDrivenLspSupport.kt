package com.rsaglobaltech.specdriven

import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.VirtualFile
import com.redhat.devtools.lsp4ij.LanguageServerFactory
import com.redhat.devtools.lsp4ij.server.ProcessStreamConnectionProvider
import com.redhat.devtools.lsp4ij.server.StreamConnectionProvider

/**
 * Thin IntelliJ ⇄ LSP glue. All the spec-driven logic lives in the shared
 * Node Language Server (`@specgate/lsp-server`); this plugin only launches it
 * and lets LSP4IJ wire diagnostics into the IDE. No business logic is
 * reimplemented in Kotlin — that is the whole point of routing through one LSP.
 */
class SpecDrivenLanguageServerFactory : LanguageServerFactory {
    override fun createConnectionProvider(project: Project): StreamConnectionProvider =
        SpecDrivenStreamConnectionProvider()
}

/**
 * Starts `spec-driven-lsp` over stdio. Resolution order:
 *   1. SPEC_DRIVEN_LSP env var (absolute path to server.js), else
 *   2. `npx --yes @specgate/lsp-server` on PATH.
 */
class SpecDrivenStreamConnectionProvider : ProcessStreamConnectionProvider() {
    init {
        val serverJs = System.getenv("SPEC_DRIVEN_LSP")
        commands =
            if (serverJs != null && serverJs.isNotBlank()) listOf("node", serverJs)
            else listOf("npx", "--yes", "@specgate/lsp-server")
    }
}

/** Restrict the server to traceability.md documents. */
object SpecDrivenFileMatcher {
    fun isSupported(file: VirtualFile): Boolean = file.name == "traceability.md"
}
