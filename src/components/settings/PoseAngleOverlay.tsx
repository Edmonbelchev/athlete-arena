import { StyleSheet, Text, View } from 'react-native';

import { PULL_UP_THRESHOLDS } from '@/constants/poseDetection';
import { Radius, Spacing } from '@/constants/theme';
import {
  formatAngleDegrees,
  formatNormalizedDelta,
  getJointAngleSnapshot,
  getPullUpPostureSnapshot,
} from '@/features/challenges/pose/jointAngles';
import type { PoseLandmark } from '@/features/challenges/pose/landmarks';
import type { PullUpDebugSnapshot } from '@/features/challenges/pose/pullUpRepEngine';

interface PoseAngleOverlayProps {
  landmarks: PoseLandmark[] | null;
  visible: boolean;
  /** Captured pull-up bar line (detection-space normalized y). */
  pullUpBarLineY?: number | null;
  /** Live pull-up rep-engine state. */
  pullUpDebug?: PullUpDebugSnapshot | null;
}

function DebugRow({
  label,
  value,
  pass,
}: {
  label: string;
  value: string;
  pass?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text
        style={[
          styles.value,
          pass === true ? styles.pass : pass === false ? styles.fail : null,
        ]}>
        {pass === undefined ? value : `${value} ${pass ? '✓' : '✗'}`}
      </Text>
    </View>
  );
}

/** Debug HUD of joint angles + pull-up posture margins. */
export function PoseAngleOverlay({
  landmarks,
  visible,
  pullUpBarLineY = null,
  pullUpDebug = null,
}: PoseAngleOverlayProps) {
  if (!visible || !landmarks?.length) {
    return null;
  }

  const angles = getJointAngleSnapshot(landmarks);
  const elbowThresholds = {
    high: PULL_UP_THRESHOLDS.upAngle,
    low: PULL_UP_THRESHOLDS.downAngle,
    hysteresis: PULL_UP_THRESHOLDS.hysteresis,
  };
  const posture = getPullUpPostureSnapshot(landmarks, pullUpBarLineY, elbowThresholds);
  const { margins } = posture;

  return (
    <View style={styles.panel} pointerEvents="none">
      <Text style={styles.title}>Joint angles</Text>
      <DebugRow label="L elbow" value={formatAngleDegrees(angles.leftElbow)} />
      <DebugRow label="R elbow" value={formatAngleDegrees(angles.rightElbow)} />
      <DebugRow label="Elbow (rep)" value={formatAngleDegrees(angles.elbowRep)} />
      <DebugRow label="L knee" value={formatAngleDegrees(angles.leftKnee)} />
      <DebugRow label="R knee" value={formatAngleDegrees(angles.rightKnee)} />
      <DebugRow label="Knee (rep)" value={formatAngleDegrees(angles.kneeRep)} />

      <Text style={[styles.title, styles.sectionTitle]}>Pull-up posture</Text>
      <DebugRow
        label="Bar Y"
        value={posture.barLineY === null ? '—' : posture.barLineY.toFixed(3)}
      />
      <DebugRow
        label={`Chin Δ (≤${margins.chinOverBarMargin})`}
        value={formatNormalizedDelta(posture.chinDelta)}
        pass={posture.chinDelta === null ? undefined : posture.chinPass}
      />
      <DebugRow
        label={`Ear Δ (≤${margins.earOverBarMargin})`}
        value={formatNormalizedDelta(posture.earDelta)}
        pass={posture.earDelta === null ? undefined : posture.earPass}
      />
      <DebugRow
        label={`Shoulder Δ (≤${margins.shoulderNearBarMargin})`}
        value={formatNormalizedDelta(posture.shoulderDelta)}
        pass={posture.shoulderDelta === null ? undefined : posture.shoulderPass}
      />
      <DebugRow
        label={`Wrist |Δ| (≤${margins.topWristNearBarMargin})`}
        value={
          posture.wristAbsDelta === null ? '—' : posture.wristAbsDelta.toFixed(3)
        }
        pass={posture.wristAbsDelta === null ? undefined : posture.wristPass}
      />
      <DebugRow label="Head over" value={posture.headOverBar ? 'yes' : 'no'} pass={posture.headOverBar} />
      <DebugRow label="Top posture" value={posture.topPosture ? 'yes' : 'no'} pass={posture.topPosture} />

      {pullUpDebug ? (
        <>
          <Text style={[styles.title, styles.sectionTitle]}>Rep engine</Text>
          <DebugRow label="Armed" value={pullUpDebug.armed ? 'yes' : 'no'} pass={pullUpDebug.armed} />
          <DebugRow label="Phase" value={pullUpDebug.phase} />
          <DebugRow
            label="Reached top"
            value={pullUpDebug.reachedTop ? 'yes' : 'no'}
            pass={pullUpDebug.reachedTop}
          />
          <DebugRow
            label="Ready frames"
            value={`${pullUpDebug.readyFrames}/${margins.readyFramesRequired}`}
          />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    top: Spacing.three,
    left: Spacing.three,
    minWidth: 168,
    maxWidth: 220,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.sm,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    gap: 2,
  },
  title: {
    color: '#FBBF24',
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 2,
  },
  sectionTitle: {
    marginTop: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  label: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 10,
    fontWeight: '600',
    flexShrink: 1,
  },
  value: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  pass: {
    color: '#86EFAC',
  },
  fail: {
    color: '#FCA5A5',
  },
});
