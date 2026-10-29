with source as (
    select * from {{ source('fitdata_raw', 'body_parts') }}
),

renamed as (
    select
        id as body_part_id,
        name as body_part_name
    from source
)

select * from renamed

