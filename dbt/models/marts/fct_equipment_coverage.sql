with exercises as (
    select * from {{ ref('dim_exercises') }}
),

coverage as (
    select
        equipment_name,
        count(distinct exercise_id) as total_exercises,
        count(distinct body_part_name) as body_parts_covered,
        count(distinct target_muscle_name) as muscles_covered
    from exercises
    where equipment_name is not null
    group by equipment_name
)

select * from coverage
order by total_exercises desc

