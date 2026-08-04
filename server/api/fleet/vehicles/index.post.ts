export default defineEventHandler(async (event) => {
  const { company } = await requireCarrierCompany(event)
  const body = await readValidatedBody(event, vehicleInputSchema.parse)

  try {
    const [vehicle] = await db.insert(vehicles).values({
      companyId: company.id,
      type: body.type,
      plate: body.plate,
      capacityKg: body.capacityKg,
      status: body.status,
      notes: body.notes ?? null,
    }).returning()
    setResponseStatus(event, 201)
    return { vehicle }
  }
  catch (err) {
    if (isUniqueViolation(err)) {
      throw createError({ statusCode: 409, statusMessage: 'A vehicle with this plate already exists' })
    }
    throw err
  }
})
