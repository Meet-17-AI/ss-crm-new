import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import './StageRemarkModal.css';

interface PreTherapyFormData {
  age: string;
  language: string[];
  language_other: string;
  location: string;
  location_manual: string;
  mode_of_session: string[];
  previous_therapy: string;
  concerns: string[];
  concerns_other: string;
  clinical_concerns_observed: string;
  clinical_concerns: string[];
  psychiatric_treatment: string;
  suicidal_thoughts: string;
  suicidal_current: string;
  suicidal_ideation_1m: string;
  suicidal_attempt_1m: string;
  preferred_therapy_approach: string;
  preferred_therapy_text: string;
  consent_explained: string;
  consent_no_reason: string;
  scope_explained: string;
  preferred_price: string;
  preferred_price_other: string;
  readiness: string[];
  readiness_other: string;
  consented_followup: string;
  followup_mode: string;
  client_questions: string;
  source: string;
  source_other: string;
  consultation_outcome: string;
  close_reason: string;
}

interface Props {
  isOpen: boolean;
  leadName: string;
  leadId: string;
  fromStage: string;
  initialAge?: string;
  isEditMode?: boolean;
  isInline?: boolean;
  initialData?: PreTherapyFormData | null;
  onConfirm: (remark: string, formData: PreTherapyFormData) => void;
  onCancel: () => void;
}

const STAGE_LABELS: Record<string, string> = {
  'lead-inquire': 'Lead / Inquire',
  'pretherapy-call': 'Pre-therapy Call',
  'followup-1': 'Follow ups',
  'booked-first-session': 'Booked First Session',
  'dropouts': 'Unresponsive',
  'leaks': 'Leaks',
};

export const emptyForm: PreTherapyFormData = {
  age: '', language: [], language_other: '', location: '', location_manual: '',
  mode_of_session: [], previous_therapy: '', concerns: [], concerns_other: '',
  clinical_concerns_observed: '', clinical_concerns: [], psychiatric_treatment: '',
  suicidal_thoughts: '', suicidal_current: '', suicidal_ideation_1m: '', suicidal_attempt_1m: '',
  preferred_therapy_approach: '', preferred_therapy_text: '',
  consent_explained: '', consent_no_reason: '', scope_explained: '', preferred_price: '', preferred_price_other: '',
  readiness: [], readiness_other: '', consented_followup: '', followup_mode: '',
  client_questions: '', source: '', source_other: '', consultation_outcome: '', close_reason: '',
};

const CheckboxGroup = ({ options, selected, onChange, columns = 2 }: {
  options: string[], selected: string[], onChange: (val: string[]) => void, columns?: number
}) => {
  const toggle = (opt: string) => {
    onChange(selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt]);
  };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: '6px 16px', marginTop: 8 }}>
      {options.map(opt => (
        <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', color: '#374151' }}>
          <input
            type="checkbox"
            checked={selected.includes(opt)}
            onChange={() => toggle(opt)}
            style={{ accentColor: '#21615D', width: 14, height: 14, cursor: 'pointer' }}
          />
          {opt}
        </label>
      ))}
    </div>
  );
};

const RadioGroup = ({ options, value, onChange }: {
  options: string[], value: string, onChange: (val: string) => void
}) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
    {options.map(opt => (
      <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', color: '#374151' }}>
        <input
          type="radio"
          checked={value === opt}
          onChange={() => onChange(opt)}
          style={{ accentColor: '#21615D', cursor: 'pointer' }}
        />
        {opt}
      </label>
    ))}
  </div>
);

const FormQuestion = ({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) => (
  <div style={{ marginBottom: 20 }}>
    <div style={{ fontWeight: 600, fontSize: 13, color: '#111827', marginBottom: 4 }}>
      {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
    </div>
    {children}
  </div>
);

const parseArrayField = (val: any) => {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
      try {
          const parsed = JSON.parse(val);
          return Array.isArray(parsed) ? parsed : [val];
      } catch {
          return [val].filter(Boolean); // fallback
      }
  }
  return [];
};

const sanitizeData = (data: any, defaultAge: string = '') => {
  if (!data) return { ...emptyForm, age: defaultAge };
  const safeData: any = {
      ...emptyForm,
      ...data,
      language: parseArrayField(data.language),
      mode_of_session: parseArrayField(data.mode_of_session),
      concerns: parseArrayField(data.concerns),
      clinical_concerns: parseArrayField(data.clinical_concerns),
      readiness: parseArrayField(data.readiness)
  };
  // Sanitize nulls to empty strings
  Object.keys(safeData).forEach(key => {
      if (safeData[key] === null) safeData[key] = '';
  });
  return safeData;
};

const PreTherapyCallFormModal: React.FC<Props> = ({ isOpen, leadName, fromStage, initialAge, isEditMode, isInline, initialData, onConfirm, onCancel }) => {
  const [form, setForm] = useState<PreTherapyFormData>(() => sanitizeData(initialData, initialAge));
  const [remark, setRemark] = useState('');
  const [showError, setShowError] = useState(false);

  // Reset form and prefill age whenever modal opens or changes
  React.useEffect(() => {
    if (isOpen) {
      setForm(sanitizeData(initialData, initialAge));
      setRemark('');
      setShowError(false);
    }
  }, [isOpen, initialAge, initialData]);

  if (!isOpen) return null;

  const set = (field: keyof PreTherapyFormData, value: any) => setForm(prev => ({ ...prev, [field]: value }));

  const handleConfirm = () => {
    if (!form.scope_explained) {
      setShowError(true);
      return;
    }
    onConfirm(remark || 'Pre-therapy call form submitted', form);
    setForm(emptyForm);
    setRemark('');
    setShowError(false);
  };

  const handleCancel = () => {
    setForm(emptyForm);
    setRemark('');
    setShowError(false);
    onCancel();
  };

  const innerContent = (
    <div
      className={isInline ? "stage-remark-inline" : "stage-remark-modal"}
      onClick={e => isInline ? undefined : e.stopPropagation()}
      style={isInline ? { 
        width: '100%', display: 'flex', flexDirection: 'column', 
        border: '1px solid #e2e8f0', borderRadius: '10px', 
        background: '#fff', marginTop: 8, overflow: 'hidden', padding: 16
      } : { 
        maxWidth: 680, maxHeight: '90vh', display: 'flex', flexDirection: 'column' 
      }}
    >
        {/* Header */}
        <div className="stage-remark-header" style={{ flexShrink: 0 }}>
          <h3>{isEditMode ? 'Edit Pre-Therapy Call Form' : 'Pre-Therapy Call Form'} — {leadName}</h3>
          <p>{isEditMode ? 'Edit the details of the pre-therapy form below.' : 'Fill in the details during the call before confirming the stage change.'}</p>
        </div>

        {/* Stage Arrow */}
        {!isEditMode && (
          <div className="stage-arrow" style={{ flexShrink: 0 }}>
            <span className="stage-badge from">{STAGE_LABELS[fromStage] || fromStage}</span>
            <svg className="stage-arrow-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
            </svg>
            <span className="stage-badge to">Pre-therapy Call</span>
          </div>
        )}

        {/* Scrollable Form */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 2px 16px', borderTop: '1px solid #e5e7eb', marginTop: 8 }}>

          {/* a. Age */}
          <FormQuestion label="A. Age">
            <input
              type="text"
              value={form.age}
              onChange={e => set('age', e.target.value)}
              placeholder="Manually input OR taken from Chatbot"
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }}
            />
          </FormQuestion>

          {/* b. Language */}
          <FormQuestion label="B. Language (select all that apply)">
            <CheckboxGroup
              options={['Hindi', 'English', 'Gujarathi', 'Marwadi', 'Marathi', 'Malayalam', 'Punjabi', 'Konkani', 'Other']}
              selected={form.language}
              onChange={v => set('language', v)}
            />
            {form.language.includes('Other') && (
              <input
                type="text"
                value={form.language_other}
                onChange={e => set('language_other', e.target.value)}
                placeholder="Please mention the language..."
                style={{ width: '100%', marginTop: 8, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }}
              />
            )}
          </FormQuestion>

          {/* c. Location */}
          <FormQuestion label="C. Location">
            <RadioGroup
              options={['Indian Resident', 'NRI']}
              value={form.location}
              onChange={v => set('location', v)}
            />
            <input
              type="text"
              value={form.location_manual}
              onChange={e => set('location_manual', e.target.value)}
              placeholder="Specify city/country (manual or from Chatbot)"
              style={{ width: '100%', marginTop: 8, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }}
            />
          </FormQuestion>

          {/* d. Mode of session */}
          <FormQuestion label="D. Mode of Session">
            <CheckboxGroup
              options={['Online', 'In-person', 'Both']}
              selected={form.mode_of_session}
              onChange={v => set('mode_of_session', v)}
              columns={3}
            />
          </FormQuestion>

          {/* e. Previous therapy */}
          <FormQuestion label="E. Previous Therapy Experience">
            <RadioGroup
              options={['Yes', 'No', 'Not sure if they were therapist']}
              value={form.previous_therapy}
              onChange={v => set('previous_therapy', v)}
            />
          </FormQuestion>

          {/* f. Concerns */}
          <FormQuestion label="F. Concerns — What are they looking for?">
            <CheckboxGroup
              options={[
                'Anxiety or Depression related concerns',
                'Relationship / Family related concerns',
                'Attachment related concerns',
                'Dealing with life transitions',
                'Life adjustment concerns',
                'Anger related concerns',
                'Mood concerns',
                'Trauma / past traumatic experiences',
                'Addiction / Substance use',
                'Gender, Sexuality & LGBTQAI+',
                'Grief / loss',
                'Identity crisis',
                'Pregnancy or parenting related concerns',
                'Work place related stress',
                'Not sure',
                'Other',
              ]}
              selected={form.concerns}
              onChange={v => set('concerns', v)}
            />
            {form.concerns.includes('Other') && (
              <input
                type="text"
                value={form.concerns_other}
                onChange={e => set('concerns_other', e.target.value)}
                placeholder="Please mention the concern..."
                style={{ width: '100%', marginTop: 8, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }}
              />
            )}
          </FormQuestion>

          {/* g. Clinical concerns */}
          <FormQuestion label="G. Any Clinical Concerns Mentioned?">
            <RadioGroup
              options={['Yes', 'No']}
              value={form.clinical_concerns_observed}
              onChange={v => set('clinical_concerns_observed', v)}
            />
            {form.clinical_concerns_observed === 'Yes' && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>If yes, select all that apply:</div>
                <CheckboxGroup
                  options={[
                    'Hallucinations', 'Delusions', 'Disorientation / Erratic Mood',
                    'Dissociation', 'Severe Panic Attacks', 'Severe Anxiety',
                    'Severe Depressive Symptoms', 'Self-Harm Ongoing', 'Mania',
                    'Paranoia', 'Impulsivity', 'Anger / Aggression',
                    'Obsessions and Compulsions', 'Health Related Anxiety', 'Seizures',
                    'Amnesia', 'Substance Abuse', 'Eating Disorder Symptoms',
                    'Developmental concerns', 'Other',
                  ]}
                  selected={form.clinical_concerns}
                  onChange={v => set('clinical_concerns', v)}
                />
                <textarea
                  value={form.psychiatric_treatment}
                  onChange={e => set('psychiatric_treatment', e.target.value)}
                  placeholder="Any ongoing/past psychiatric treatment or medications..."
                  rows={2}
                  style={{ width: '100%', marginTop: 10, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }}
                />
              </div>
            )}
          </FormQuestion>

          {/* h. Suicidal thoughts */}
          <FormQuestion label="H. Any Suicidal Thoughts Mentioned?">
            <RadioGroup
              options={['Yes', 'No', "Couldn't explore"]}
              value={form.suicidal_thoughts}
              onChange={v => set('suicidal_thoughts', v)}
            />
            {form.suicidal_thoughts === 'Yes' && (
              <div style={{ marginTop: 10, padding: 12, backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#991b1b', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertTriangle size={14} /> Clinical Safety Assessment
                </div>
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Any ongoing/current suicidal thoughts/attempt:</div>
                  <RadioGroup
                    options={['Yes - Referral to be initiated', 'No']}
                    value={form.suicidal_current}
                    onChange={v => set('suicidal_current', v)}
                  />
                </div>
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Suicidal ideation in last 1 month:</div>
                  <RadioGroup options={['Yes', 'No']} value={form.suicidal_ideation_1m} onChange={v => set('suicidal_ideation_1m', v)} />
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Suicidal attempt in last 1 month:</div>
                  <RadioGroup options={['Yes', 'No']} value={form.suicidal_attempt_1m} onChange={v => set('suicidal_attempt_1m', v)} />
                </div>
              </div>
            )}
          </FormQuestion>

          {/* i. Preferred therapy approach */}
          <FormQuestion label="I. Any Preferred Therapy Approach/Needs?">
            <RadioGroup options={['Yes', 'No']} value={form.preferred_therapy_approach} onChange={v => set('preferred_therapy_approach', v)} />
            {form.preferred_therapy_approach === 'Yes' && (
              <textarea
                value={form.preferred_therapy_text}
                onChange={e => set('preferred_therapy_text', e.target.value)}
                placeholder="e.g. gender of therapist, years of Experience, Queer affirmative, Trauma informed, Art based, techniques, Crisis based support..."
                rows={2}
                style={{ width: '100%', marginTop: 8, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }}
              />
            )}
          </FormQuestion>

          {/* j. Consent explained */}
          <FormQuestion label="J. Explained Consent Form and Confidentiality">
            <RadioGroup
              options={['Yes, explained', 'Yes, but client had more questions', 'No - Mention Reason']}
              value={form.consent_explained}
              onChange={v => set('consent_explained', v)}
            />
            {form.consent_explained === 'No - Mention Reason' && (
              <input
                type="text"
                value={form.consent_no_reason}
                onChange={e => set('consent_no_reason', e.target.value)}
                placeholder="Please mention the reason..."
                style={{ width: '100%', marginTop: 8, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }}
              />
            )}
          </FormQuestion>

          {/* k. Scope explained - mandatory */}
          <FormQuestion label="K. Explained Scope of Service (mandatory)" required>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4, lineHeight: 1.5 }}>
              Explained that this is not a medical/crisis/emergency helpline or mental health care unit. That this is not designed for severe clinical conditions and that the team will refer them if their concerns/needs are beyond our scope of work.
            </div>
            <RadioGroup options={['Yes', 'No']} value={form.scope_explained} onChange={v => set('scope_explained', v)} />
            {showError && !form.scope_explained && (
              <div style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>This field is required.</div>
            )}
          </FormQuestion>

          {/* l. Preferred price */}
          <FormQuestion label="L. Preferred Price Range">
            <RadioGroup options={['1200', '1700', '3000', 'Other']} value={form.preferred_price} onChange={v => set('preferred_price', v)} />
            {form.preferred_price === 'Other' && (
              <input
                type="text"
                value={form.preferred_price_other}
                onChange={e => set('preferred_price_other', e.target.value)}
                placeholder="Please mention the preferred price..."
                style={{ width: '100%', marginTop: 8, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }}
              />
            )}
          </FormQuestion>

          {/* m. Readiness */}
          <FormQuestion label="M. Readiness — When are they looking for a session?">
            <CheckboxGroup
              options={['Immediate (Within 0-2 days)', '2-5 days', '5-10 days', 'Not sure', 'Other']}
              selected={form.readiness}
              onChange={v => set('readiness', v)}
              columns={1}
            />
            {form.readiness.includes('Other') && (
              <input
                type="text"
                value={form.readiness_other}
                onChange={e => set('readiness_other', e.target.value)}
                placeholder="Please mention the timeframe..."
                style={{ width: '100%', marginTop: 8, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }}
              />
            )}
          </FormQuestion>

          {/* n. Consented to follow up */}
          <FormQuestion label="N. Consented to Follow Up — Can we check in with you tomorrow?">
            <RadioGroup options={['Yes', 'No']} value={form.consented_followup} onChange={v => set('consented_followup', v)} />
            {form.consented_followup === 'Yes' && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>What mode would they prefer?</div>
                <CheckboxGroup options={['Text', 'Call']} selected={form.followup_mode ? [form.followup_mode] : []} onChange={v => set('followup_mode', v[v.length - 1] || '')} columns={2} />
              </div>
            )}
          </FormQuestion>

          {/* o. Client questions */}
          <FormQuestion label="O. Questions the Client Asked About Therapy">
            <textarea
              value={form.client_questions}
              onChange={e => set('client_questions', e.target.value)}
              placeholder="Questions asked and brief answers given..."
              rows={3}
              style={{ width: '100%', marginTop: 4, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }}
            />
          </FormQuestion>

          {/* p. Source */}
          <FormQuestion label="P. Source — How did you hear about us?">
            <RadioGroup
              options={['Referred by someone', 'Website', 'Instagram', 'Google Search', 'Linkedin', 'Other (Mention)']}
              value={form.source}
              onChange={v => set('source', v)}
            />
            {form.source === 'Other (Mention)' && (
              <input
                type="text"
                value={form.source_other}
                onChange={e => set('source_other', e.target.value)}
                placeholder="Please mention the source..."
                style={{ width: '100%', marginTop: 8, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }}
              />
            )}
          </FormQuestion>

          {/* q. Consultation Call Done */}
          <FormQuestion label="Q. Consultation Call Done">
            <RadioGroup
              options={['Session booked', 'To be Followed up', 'Referred', 'Closed - Reason']}
              value={form.consultation_outcome}
              onChange={v => set('consultation_outcome', v)}
            />
            {form.consultation_outcome === 'Closed - Reason' && (
              <input
                type="text"
                value={form.close_reason}
                onChange={e => set('close_reason', e.target.value)}
                placeholder="Reason for closing..."
                style={{ width: '100%', marginTop: 8, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }}
              />
            )}
          </FormQuestion>

          {/* Additional remark */}
          {!isEditMode && (
            <FormQuestion label="Additional Remark (optional)">
              <textarea
                value={remark}
                onChange={e => setRemark(e.target.value)}
                placeholder="Any additional notes for this stage move..."
                rows={2}
                style={{ width: '100%', marginTop: 4, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }}
              />
            </FormQuestion>
          )}
        </div>

        {/* Footer */}
        <div className="stage-remark-footer" style={{ flexShrink: 0, borderTop: '1px solid #e5e7eb', paddingTop: 12, marginTop: 4 }}>
          <button className="btn-cancel" onClick={handleCancel}>Cancel</button>
          <button className="btn-confirm" onClick={handleConfirm}>{isEditMode ? 'Save Changes' : 'Submit & Confirm Move'}</button>
        </div>
    </div>
  );

  return isInline ? innerContent : (
    <div className="stage-remark-overlay" onClick={handleCancel}>
      {innerContent}
    </div>
  );
};

export default PreTherapyCallFormModal;
export type { PreTherapyFormData };
