with exercises as (
    select * from {{ ref('stg_exercises') }}
),

body_parts as (
    select * from {{ ref('stg_body_parts') }}
),

equipment as (
    select * from {{ ref('stg_equipment') }}
),

muscles as (
    select * from {{ ref('stg_muscles') }}
),

final as (
    select
        e.exercise_id,
        e.exercise_name,
        e.category,
        e.muscle_group,
        bp.body_part_name,
        eq.equipment_name,
        m.muscle_name as target_muscle_name,
        e.created_at,
        e.updated_at
    from exercises e
    left join body_parts bp on e.body_part_id = bp.body_part_id
    left join equipment eq on e.equipment_id = eq.equipment_id
    left join muscles m on e.target_muscle_id = m.muscle_id
)

select * from final

