with exercises as (
    select * from {{ ref('dim_exercises') }}
),

muscle_agg as (
    select
        target_muscle_name as muscle_name,
        muscle_group,
        count(distinct exercise_id) as total_exercises,
        count(distinct equipment_name) as distinct_equipment_options
    from exercises
    where target_muscle_name is not null
    group by target_muscle_name, muscle_group
)

select * from muscle_agg
order by total_exercises desc

