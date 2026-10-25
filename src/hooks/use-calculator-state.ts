'use client';

import { useReducer } from 'react';
import { EMPTY_LEAD_FORM, type LeadFormValues } from '@/lib/lead-validation';
import type { Estimate } from '@/lib/valuation';

export type TextField = 'firstName' | 'lastName' | 'company' | 'email' | 'phone' | 'nextMoveOther';

export interface CalculatorState {
  values: LeadFormValues;
  error: string | null;
  /** Snapshot of the submitted estimate; null while locked. */
  result: Estimate | null;
  /** Bumped on reset to remount the form, clearing any browser autofill residue. */
  formKey: number;
}

type Action =
  | { type: 'setArr'; arr: number | null }
  | { type: 'setSelection'; selection: string }
  | { type: 'setText'; field: TextField; value: string }
  | { type: 'setNextMove'; nextMove: string }
  | { type: 'fail'; message: string }
  | { type: 'unlock'; result: Estimate }
  | { type: 'reset' };

const INITIAL: CalculatorState = { values: EMPTY_LEAD_FORM, error: null, result: null, formKey: 0 };

function reducer(state: CalculatorState, action: Action): CalculatorState {
  // Inputs are frozen once the result is shown, until "Next visitor".
  if (state.result && action.type !== 'reset') return state;
  switch (action.type) {
    case 'setArr':
      return { ...state, values: { ...state.values, arr: action.arr } };
    case 'setSelection':
      return { ...state, values: { ...state.values, selection: action.selection } };
    case 'setText':
      return { ...state, values: { ...state.values, [action.field]: action.value } };
    case 'setNextMove':
      return { ...state, values: { ...state.values, nextMove: action.nextMove } };
    case 'fail':
      return { ...state, error: action.message };
    case 'unlock':
      return { ...state, error: null, result: action.result };
    case 'reset':
      return { ...INITIAL, formKey: state.formKey + 1 };
  }
}

export function useCalculatorState() {
  return useReducer(reducer, INITIAL);
}
