import type { WorkoutBlockType } from "@/lib/public/workout-log";

export type HyroxPresetKey =
  | "singles_women_open"
  | "singles_women_pro"
  | "singles_men_open"
  | "singles_men_pro"
  | "doubles_women"
  | "doubles_men"
  | "doubles_mixed";

export interface HyroxPresetOption {
  key: HyroxPresetKey;
  label: string;
  detail: string;
}

export interface HyroxPresetExercise {
  slug: string;
  label: string;
  notes?: string;
  targetReps?: string;
  targetWeightKg?: number;
  blockType: WorkoutBlockType;
  set: {
    reps?: number;
    weightKg?: number;
    distanceM?: number;
    durationSeconds?: number;
  };
}

const RUN_DISTANCE_METERS = 1000;

type HyroxWeights = {
  sledPushKg: number;
  sledPullKg: number;
  farmerCarryKg: number;
  sandbagLungeKg: number;
  wallBallKg: number;
};

const HYROX_WEIGHT_PROFILES: Record<HyroxPresetKey, HyroxWeights> = {
  singles_women_open: {
    sledPushKg: 102,
    sledPullKg: 78,
    farmerCarryKg: 16,
    sandbagLungeKg: 10,
    wallBallKg: 4
  },
  singles_women_pro: {
    sledPushKg: 152,
    sledPullKg: 103,
    farmerCarryKg: 24,
    sandbagLungeKg: 20,
    wallBallKg: 6
  },
  singles_men_open: {
    sledPushKg: 152,
    sledPullKg: 103,
    farmerCarryKg: 24,
    sandbagLungeKg: 20,
    wallBallKg: 6
  },
  singles_men_pro: {
    sledPushKg: 202,
    sledPullKg: 153,
    farmerCarryKg: 32,
    sandbagLungeKg: 30,
    wallBallKg: 9
  },
  doubles_women: {
    sledPushKg: 102,
    sledPullKg: 78,
    farmerCarryKg: 16,
    sandbagLungeKg: 10,
    wallBallKg: 4
  },
  doubles_men: {
    sledPushKg: 152,
    sledPullKg: 103,
    farmerCarryKg: 24,
    sandbagLungeKg: 20,
    wallBallKg: 6
  },
  doubles_mixed: {
    sledPushKg: 102,
    sledPullKg: 78,
    farmerCarryKg: 24,
    sandbagLungeKg: 20,
    wallBallKg: 6
  }
};

export const HYROX_PRESET_OPTIONS: HyroxPresetOption[] = [
  {
    key: "singles_women_open",
    label: "Singles Women Open",
    detail: "Official HYROX women open weights."
  },
  {
    key: "singles_women_pro",
    label: "Singles Women Pro",
    detail: "Official HYROX women pro weights."
  },
  {
    key: "singles_men_open",
    label: "Singles Men Open",
    detail: "Official HYROX men open weights."
  },
  {
    key: "singles_men_pro",
    label: "Singles Men Pro",
    detail: "Official HYROX men pro weights."
  },
  {
    key: "doubles_women",
    label: "Doubles Women",
    detail: "Official HYROX doubles women standard."
  },
  {
    key: "doubles_men",
    label: "Doubles Men",
    detail: "Official HYROX doubles men standard."
  },
  {
    key: "doubles_mixed",
    label: "Doubles Mixed",
    detail: "Official HYROX doubles mixed standard."
  }
];

export const HYROX_REQUIRED_EXERCISE_SLUGS = [
  "run",
  "ski-erg",
  "sled-push",
  "sled-pull",
  "burpee-broad-jump",
  "row-erg",
  "farmers-carry",
  "sandbag-lunges",
  "wall-balls"
] as const;

function buildHyroxTitle(key: HyroxPresetKey): string {
  return HYROX_PRESET_OPTIONS.find((option) => option.key === key)?.label ?? "HYROX";
}

function createRunSplit(index: number): HyroxPresetExercise {
  return {
    slug: "run",
    label: `Run ${index}`,
    notes: "Official HYROX run split.",
    blockType: "circuit",
    set: {
      distanceM: RUN_DISTANCE_METERS
    }
  };
}

export function buildHyroxPreset(key: HyroxPresetKey): {
  title: string;
  exercises: HyroxPresetExercise[];
} {
  const weights = HYROX_WEIGHT_PROFILES[key];

  return {
    title: `HYROX ${buildHyroxTitle(key)}`,
    exercises: [
      createRunSplit(1),
      {
        slug: "ski-erg",
        label: "SkiErg",
        notes: "Official HYROX station distance.",
        blockType: "circuit",
        set: {
          distanceM: 1000
        }
      },
      createRunSplit(2),
      {
        slug: "sled-push",
        label: "Sled Push",
        notes: "Official HYROX station distance.",
        targetWeightKg: weights.sledPushKg,
        blockType: "circuit",
        set: {
          distanceM: 50,
          weightKg: weights.sledPushKg
        }
      },
      createRunSplit(3),
      {
        slug: "sled-pull",
        label: "Sled Pull",
        notes: "Official HYROX station distance.",
        targetWeightKg: weights.sledPullKg,
        blockType: "circuit",
        set: {
          distanceM: 50,
          weightKg: weights.sledPullKg
        }
      },
      createRunSplit(4),
      {
        slug: "burpee-broad-jump",
        label: "Burpee Broad Jump",
        notes: "Official HYROX station distance.",
        blockType: "circuit",
        set: {
          distanceM: 80
        }
      },
      createRunSplit(5),
      {
        slug: "row-erg",
        label: "Row Erg",
        notes: "Official HYROX station distance.",
        blockType: "circuit",
        set: {
          distanceM: 1000
        }
      },
      createRunSplit(6),
      {
        slug: "farmers-carry",
        label: "Farmers Carry",
        notes: "Official HYROX station distance.",
        targetWeightKg: weights.farmerCarryKg,
        blockType: "circuit",
        set: {
          distanceM: 200,
          weightKg: weights.farmerCarryKg
        }
      },
      createRunSplit(7),
      {
        slug: "sandbag-lunges",
        label: "Sandbag Lunges",
        notes: "Official HYROX station distance.",
        targetWeightKg: weights.sandbagLungeKg,
        blockType: "circuit",
        set: {
          distanceM: 100,
          weightKg: weights.sandbagLungeKg
        }
      },
      createRunSplit(8),
      {
        slug: "wall-balls",
        label: "Wall Balls",
        notes: "Official HYROX station reps.",
        targetReps: "100",
        targetWeightKg: weights.wallBallKg,
        blockType: "circuit",
        set: {
          reps: 100,
          weightKg: weights.wallBallKg
        }
      }
    ]
  };
}
