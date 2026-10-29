with source as (
    select * from {{ source('fitdata_raw', 'muscles') }}
),

renamed as (
    select
        id as muscle_id,
        name as muscle_name
    from source
)

select * from renamed

