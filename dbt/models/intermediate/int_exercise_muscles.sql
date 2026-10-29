with exercise_muscles as (
    select * from {{ source('fitdata_raw', 'exercise_muscles') }}
),

muscles as (
    select * from {{ ref('stg_muscles') }}
),

joined as (
    select
        em.exercise_id,
        em.muscle_id,
        m.muscle_name,
        em.is_primary
    from exercise_muscles em
    inner join muscles m on em.muscle_id = m.muscle_id
)

select * from joined

