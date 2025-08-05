interface GuardrailResult {
  verdict: 'CONFIRM' | 'OVERRIDE';
  reason_code: 'BOUNDARY' | 'MANIPULATION' | 'JAILBREAK' | 'HALLUCINATION';
  evidence: string[];
  action: 'ALLOW' | 'BLOCK' | 'ESCALATE';
}

function checkGuardrails(input: string, reasoning: string, output: string): GuardrailResult {
  const evidence: string[] = [];
  let reason_code: GuardrailResult['reason_code'] = 'BOUNDARY';
  let action: GuardrailResult['action'] = 'ALLOW';

  // Check for jailbreak attempts
  const jailbreakKeywords = [
    'ignore prior instructions',
    'ignore all previous',
    'forget everything',
    'ignore rules',
    'ignore guidelines',
    'ignore policies'
  ];

  const hasJailbreak = jailbreakKeywords.some(keyword => 
    input.toLowerCase().includes(keyword.toLowerCase()) ||
    reasoning.toLowerCase().includes(keyword.toLowerCase())
  );

  if (hasJailbreak) {
    evidence.push('HBC-1: Jailbreak attempt detected');
    reason_code = 'JAILBREAK';
    action = 'BLOCK';
  }

  // Check for refund amount limits
  const refundMatch = output.match(/\$(\d+(?:\.\d{2})?)/g);
  if (refundMatch) {
    const amounts = refundMatch.map(amt => parseFloat(amt.replace('$', '')));
    const maxAmount = Math.max(...amounts);
    
    if (maxAmount > 60) {
      evidence.push(`HBC-2: Refund amount $${maxAmount} exceeds limit of $60`);
      reason_code = 'BOUNDARY';
      action = 'ESCALATE';
    }
  }

  // Check for emotional manipulation
  const emotionalKeywords = [
    'please help me',
    'i\'m desperate',
    'i have no money',
    'i\'m starving',
    'i\'ll die',
    'emergency'
  ];

  const hasEmotionalManipulation = emotionalKeywords.some(keyword =>
    input.toLowerCase().includes(keyword.toLowerCase())
  );

  if (hasEmotionalManipulation) {
    evidence.push('HBC-3: Potential emotional manipulation detected');
    reason_code = 'MANIPULATION';
    action = 'ESCALATE';
  }

  // Check for frequency triggers (simplified)
  if (input.toLowerCase().includes('refund') && input.toLowerCase().includes('again')) {
    evidence.push('HBC-4: Frequent refund request detected');
    reason_code = 'BOUNDARY';
    action = 'ESCALATE';
  }

  // Check for suspicious patterns
  if (input.toLowerCase().includes('any reason') || input.toLowerCase().includes('whatever')) {
    evidence.push('HBC-5: Suspicious refund request pattern');
    reason_code = 'BOUNDARY';
    action = 'ESCALATE';
  }

  const verdict: GuardrailResult['verdict'] = action === 'ALLOW' ? 'CONFIRM' : 'OVERRIDE';

  return {
    verdict,
    reason_code,
    evidence: evidence.length > 0 ? evidence : ['No specific issues detected'],
    action
  };
}

module.exports = { checkGuardrails };