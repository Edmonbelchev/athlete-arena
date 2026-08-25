-- Allow rounds-based For Time circuit structure in structure_config.

alter table public.custom_workout_templates
  drop constraint if exists custom_workout_templates_structure_config_check;

alter table public.custom_workout_templates
  add constraint custom_workout_templates_structure_config_check check (
    structure_config is null
    or (
      structure_config->>'structure' = 'ladder'
      and jsonb_typeof(structure_config->'repScheme') = 'array'
      and jsonb_array_length(structure_config->'repScheme') > 0
    )
    or (
      structure_config->>'structure' = 'rounds'
      and (structure_config->>'rounds') ~ '^[1-9][0-9]*$'
    )
    or structure_config->>'structure' = 'linear'
  );

alter table public.workout_catalog
  drop constraint if exists workout_catalog_structure_config_check;

alter table public.workout_catalog
  add constraint workout_catalog_structure_config_check check (
    structure_config is null
    or (
      structure_config->>'structure' = 'ladder'
      and jsonb_typeof(structure_config->'repScheme') = 'array'
      and jsonb_array_length(structure_config->'repScheme') > 0
    )
    or (
      structure_config->>'structure' = 'rounds'
      and (structure_config->>'rounds') ~ '^[1-9][0-9]*$'
    )
    or structure_config->>'structure' = 'linear'
  );
