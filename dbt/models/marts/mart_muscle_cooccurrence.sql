with em1 as (
    select exercise_id, muscle_name
    from {{ ref('int_exercise_muscles') }}
),

em2 as (
    select exercise_id, muscle_name
    from {{ ref('int_exercise_muscles') }}
),

pairs as (
    select
        em1.muscle_name as muscle_a,
        em2.muscle_name as muscle_b,
        count(distinct em1.exercise_id) as co_occurrence_count
    from em1
    inner join em2 on em1.exercise_id = em2.exercise_id
    where em1.muscle_name < em2.muscle_name
    group by em1.muscle_name, em2.muscle_name
)

select
    muscle_a,
    muscle_b,
    co_occurrence_count
from pairs
order by co_occurrence_count desc

