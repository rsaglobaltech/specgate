# Capability — Clinical record

The record-keeping half of a clinical system. It ships no clinical rule: what a diagnosis means, which interaction database to trust and what the law requires are questions for the client, and the one the pilot could not answer stays open below.

Installed into {{PROJECT_NAME}} from a proven Specgate pack. Derived from the clinical-cases pilot (HealthTech): implemented and tested in Quarkus 3 on PostgreSQL with fictitious data only; 23 of 24 requirements, 35 tests green. The pilot's code is private; its requirements and scenarios are what this pack carries.

### Requirement: REQ-401 — Open a clinical case

<!-- csda:trace kind=functional -->

**Obligation (MUST).** A physician opens a case for a patient with the reason for the visit; the physician who opens it is responsible for it and the case is "open".

### Requirement: REQ-402 — Only the care team sees the case

<!-- csda:trace kind=business-rule -->

**Obligation (MUST).** Only the physician responsible and the physicians they add to the care team can read or annotate a case; anyone else gets the answer for a case that does not exist.

### Requirement: REQ-403 — Every annotation is signed by its author

<!-- csda:trace kind=business-rule -->

**Obligation (MUST).** Symptoms, diagnoses and treatments are recorded as annotations carrying their author and time. A diagnosis carries an ICD-10 code and moves from "provisional" to "confirmed"; a code that does not have the shape of an ICD-10 code is refused (shape only — the pack does not judge the diagnosis).

Source: World Health Organization, International Classification of Diseases, 10th revision (ICD-10) — https://icd.who.int/browse10/2019/en

### Requirement: REQ-404 — Nothing is deleted: corrections are added

<!-- csda:trace kind=business-rule -->

**Obligation (MUST).** No annotation of a case can be changed or deleted; a correction is a new annotation that cites the one it corrects, and both appear in the timeline with their author and time.

### Requirement: REQ-405 — Timeline and state as at any past instant

<!-- csda:trace kind=functional -->

**Obligation (MUST).** The care team sees the full timeline of the case in order, and the state of the case is rebuilt as it was at any past instant: diagnoses and their status, treatments, and whether it was open.

### Requirement: REQ-406 — Close the case

<!-- csda:trace kind=functional -->

**Obligation (SHOULD).** The physician responsible closes a case with a reason ("resolved", "referred" or "abandoned"); a closed case accepts no new annotation except corrections.

### Requirement: REQ-407 — Every access to clinical data is logged, immutably

<!-- csda:trace kind=business-rule -->

**Obligation (MUST).** Every read of a patient's clinical data, and every denied attempt, is logged with who, which patient, which resource, the outcome and the time. The log cannot be changed or deleted, and an entry survives the rollback of the request that caused it.

### Requirement: REQ-408 — The privacy officer reviews a patient's accesses

<!-- csda:trace kind=functional -->

**Obligation (SHOULD).** The person responsible for privacy sees the accesses to a patient's data, newest first, finding the patient by name.

### Requirement: REQ-409 — Drug interaction alerts

<!-- csda:trace kind=functional status="Needs Clarification" -->

**Obligation (SHOULD).** When prescribing, the physician is warned of known interactions between the new drug and the patient's active prescriptions, with severity and source. Open on purpose: which interaction database to license, its severity scale and who is liable for it are the client's decisions. The pilot did not build it and this pack ships no interaction rule.

> **Open question.** This requirement is installed as *Needs Clarification*: `specgate done` refuses it until the answer is written down.

## Business rules

- **Fictitious data only in development and tests.** The pilot used invented patients throughout.
- **The access log is written in its own transaction.** The pilot used REQUIRES_NEW so a denied request still leaves its trace.
