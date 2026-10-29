with source as (
    select * from {{ source('fitdata_raw', 'exercises') }}
),

renamed as (
    select
        id as exercise_id,
        name as exercise_name,
        category,
        body_part_id,
        equipment_id,
        target_muscle_id,
        muscle_group,
        created_at,
        updated_at
    from source
)

select * from renamed

