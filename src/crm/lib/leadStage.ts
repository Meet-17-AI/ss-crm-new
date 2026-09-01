/**
 * Everything that happens when a lead changes stage, in one place.
 *
 * A stage move used to live inside the pipeline's drag-and-drop handler, which
 * made the drag the only way to perform one. It isn't: the drag only chooses
 * (lead, fromStage, toStage) — the remark, the write, the follow-up form and the
 * outcome routing that follow are the actual feature, and they belong to any
 * surface that wants to move a lead.
 *
 * The stage table lived in four files with three different orderings and two
 * spellings of "Follow Ups". Keeping it here means a surface cannot disagree
 * with the board about what the stages are.
 *
 * The server is still the authority on storage: crm-backend writes the remark
 * column, stamps the timestamp, cycles the follow-up slots and resolves the
 * therapist. This module only decides what to ask it for.
 */

export type StageId =
  | 'lead-inquire'
  | 'pretherapy-call'
  | 'followup-1'
  | 'booked-first-session'
  | 'referred'
  | 'closed'
  | 'dropouts';

/** Board order, left to right. */
export const STAGE_ORDER: StageId[] = [
  'lead-inquire',
  'pretherapy-call',
  'followup-1',
  'booked-first-session',
  'referred',
  'dropouts',
  'closed',
];

export const STAGE_LABELS: Record<StageId, string> = {
  'lead-inquire': 'Lead / Inquire',
  'pretherapy-call': 'Pre-therapy Call',
  'followup-1': 'Follow Ups',
  'booked-first-session': 'Booked First Session',
  'referred': 'Referred',
  'closed': 'Closed',
  'dropouts': 'Unresponsive',
};

/** Falls back to the raw id so an unrecognised stage is visible, not blank. */
export const stageLabel = (id?: string): string =>
  (id && STAGE_LABELS[id as StageId]) || id || '';

/**
 * Moving into the pre-therapy call collects the clinical form instead of a plain
 * remark, so callers need to know which modal to open.
 */
export const needsPreTherapyForm = (toStage: string): boolean =>
  toStage === 'pretherapy-call';

/**
 * Where a lead really lands after a pre-therapy call.
 *
 * The call's outcome overrides the destination — someone dragged to
 * "Pre-therapy Call", but booking a session there means the lead belongs in
 * "Booked First Session". The server applies the same table when it stores the
 * form; this copy exists so the UI can show the result immediately instead of
 * flashing the wrong column.
 *
 * Matched case-insensitively on purpose. The form offers "To be Followed up"
 * while the server compared against "To be followed up", so that one outcome
 * silently failed to route and the lead snapped back to Pre-therapy Call on the
 * next reload.
 */
const OUTCOME_STAGE: Record<string, StageId> = {
  'session booked': 'booked-first-session',
  'to be followed up': 'followup-1',
  'referred': 'referred',
  'closed - reason': 'closed',
};

export const resolveFinalStage = (toStage: string, consultationOutcome?: string): string => {
  if (!needsPreTherapyForm(toStage) || !consultationOutcome) return toStage;
  return OUTCOME_STAGE[consultationOutcome.trim().toLowerCase()] || toStage;
};

export interface MoveLeadStageInput {
  leadId: string;
  toStage: string;
  /** Required by every surface — the server stores it against the stage. */
  remark: string;
  /** followup-1 only. */
  followUpDate?: string;
  futureAction?: string;
  /** Present only when moving into the pre-therapy call. */
  formData?: { consultation_outcome?: string; [key: string]: any } | null;
  actingUser?: { id?: number | string | null; name?: string | null } | null;
}

/**
 * Performs the move. Throws on failure so callers can leave their own toast and
 * rollback policy where it belongs.
 *
 * The stage PATCH and the pre-therapy form POST are two requests because the
 * server keeps the form in its own table and applies the outcome routing while
 * storing it. The PATCH goes first: it writes the remark against
 * `pretherapy-call` and stamps that stage, which is the record of the call
 * happening. The POST may then move the lead onward.
 */
export async function moveLeadStage(input: MoveLeadStageInput): Promise<any> {
  const { leadId, toStage, remark, followUpDate, futureAction, formData, actingUser } = input;

  const res = await fetch(`/api/leads/${leadId}/stage`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pipeline_stage: toStage,
      remark,
      ...(followUpDate ? { follow_up_date: followUpDate } : {}),
      ...(futureAction ? { future_action: futureAction } : {}),
      ...(actingUser ? { _audit_user: { id: actingUser.id ?? null, name: actingUser.name ?? null } } : {}),
    }),
  });
  if (!res.ok) throw new Error('Failed to update stage');
  const updated = await res.json();

  if (needsPreTherapyForm(toStage) && formData) {
    // Deliberately not fatal. The stage move is already stored; failing the whole
    // call here would report an error for something that did happen, and the form
    // can be filled again from the profile.
    try {
      await fetch('/api/pretherapy-form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: leadId,
          submitted_by: actingUser?.id ?? null,
          ...formData,
        }),
      });
    } catch (err) {
      console.error('Stage moved, but the pre-therapy form did not save:', err);
    }
  }

  return updated;
}
