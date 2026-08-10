export type GoalPeriod = 'daily' | 'weekly';

export type GoalStatus = 'active' | 'completed' | 'cancelled';

export type GoalActivityKind = 'reps' | 'distance' | 'steps';

export type GoalTrackingMode = 'auto_reps' | 'manual';

export interface GoalActivityCatalogItem {
  id: string;
  kind: GoalActivityKind;
  label: string;
  unitSingular: string;
  unitPlural: string;
  exerciseType: string | null;
  trackingMode: GoalTrackingMode;
  decimalPlaces: number;
  sortOrder: number;
  enabled: boolean;
}

export interface UserGoal {
  id: string;
  activityId: string;
  activityLabel: string;
  activityKind: GoalActivityKind;
  unitSingular: string;
  unitPlural: string;
  trackingMode: GoalTrackingMode;
  decimalPlaces: number;
  period: GoalPeriod;
  targetValue: number;
  currentValue: number;
  periodStart: string;
  periodEnd: string;
  status: GoalStatus;
  completedAt: string | null;
  createdAt: string;
}
