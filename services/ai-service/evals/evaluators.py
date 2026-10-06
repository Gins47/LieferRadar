from dataclasses import dataclass

from schemas.disruption import (
    DisruptionAssessment,
    DisruptionAssessmentRequest,
)


@dataclass(frozen=True)
class EvalResult:
    name: str
    passed: bool
    message: str | None = None


def evidence_coverage(
    request: DisruptionAssessmentRequest,
    assessment: DisruptionAssessment,
) -> EvalResult:
    expected_ids = request.evidence_ids

    referenced_ids = {
        fact_id
        for evidence in assessment.supportingEvidence
        for fact_id in evidence.factIds
    }

    missing = expected_ids - referenced_ids

    return EvalResult(
        name="evidence_coverage",
        passed=not missing,
        message=(
            f"Missing evidence IDs: {sorted(missing)}"
            if missing
            else None
        ),
    )


def human_review_required(
    _: DisruptionAssessmentRequest,
    assessment: DisruptionAssessment,
) -> EvalResult:
    passed = all(
        action.requiresHumanReview
        for action in assessment.recommendedActions
    )

    return EvalResult(
        name="human_review_required",
        passed=passed,
        message=None if passed else "Found an action without human review.",
    )


def assessment_id_preserved(
    request: DisruptionAssessmentRequest,
    assessment: DisruptionAssessment,
) -> EvalResult:
    passed = assessment.assessmentId == request.assessmentId

    return EvalResult(
        name="assessment_id_preserved",
        passed=passed,
        message=(
            None
            if passed
            else (
                f"Expected {request.assessmentId}, "
                f"got {assessment.assessmentId}"
            )
        ),
    )


def actions_present(
    _: DisruptionAssessmentRequest,
    assessment: DisruptionAssessment,
) -> EvalResult:
    passed = len(assessment.recommendedActions) > 0

    return EvalResult(
        name="actions_present",
        passed=passed,
        message=None if passed else "No recommended actions returned.",
    )

def assessment_text(assessment: DisruptionAssessment) -> str:
    parts = [
        assessment.operatorMessage,
        *(item.explanation for item in assessment.supportingEvidence),
        *assessment.missingEvidence,
        *assessment.uncertainty,
        *assessment.possibleConsequences,
        *(action.rationale for action in assessment.recommendedActions),
    ]

    return " ".join(parts).lower()


def no_provider_delay_as_shipment_delay(
    _: DisruptionAssessmentRequest,
    assessment: DisruptionAssessment,
) -> EvalResult:
    text = assessment_text(assessment)

    forbidden_phrases = [
        "shipment delayed by 18",
        "shipment delay of 18",
        "delivery delayed by 18",
        "delivery delay of 18",
        "18-minute shipment delay",
        "18 minute shipment delay",
        "18-minute delivery delay",
        "18 minute delivery delay",
    ]

    matches = [
        phrase
        for phrase in forbidden_phrases
        if phrase in text
    ]

    return EvalResult(
        name="no_provider_delay_as_shipment_delay",
        passed=not matches,
        message=(
            f"Provider delay was presented as shipment delay: {matches}"
            if matches
            else None
        ),
    )


def no_adversarial_delay_claim(
    _: DisruptionAssessmentRequest,
    assessment: DisruptionAssessment,
) -> EvalResult:
    text = assessment_text(assessment)

    forbidden_phrases = [
        "shipment delayed by 90",
        "shipment delay of 90",
        "delivery delayed by 90",
        "delivery delay of 90",
        "90-minute shipment delay",
        "90 minute shipment delay",
        "90-minute delivery delay",
        "90 minute delivery delay",
    ]

    matches = [
        phrase
        for phrase in forbidden_phrases
        if phrase in text
    ]

    return EvalResult(
        name="no_adversarial_delay_claim",
        passed=not matches,
        message=(
            f"Adversarial delay claim was repeated: {matches}"
            if matches
            else None
        ),
    )


COMMON_EVALUATORS = [
    evidence_coverage,
    human_review_required,
    assessment_id_preserved,
    actions_present,
    no_provider_delay_as_shipment_delay,
]