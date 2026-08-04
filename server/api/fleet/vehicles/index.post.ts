export default defineEventHandler(async (event) => {
  const { company } = await requireCarrierCompany(event)
  const body = await readValidatedBody(event, vehicleInputSchema.parse)

  try {
    const [vehicle] = await db.insert(vehicles).values({
      companyId: company.id,
      type: body.type,
      plate: body.plate,
      capacityLbs: body.capacityLbs,
      status: body.status,
      notes: body.notes ?? null,
      insurancePolicy: body.insurancePolicy ?? null,
      insuranceExpiresAt: body.insuranceExpiresAt ?? null,
      nextServiceDueAt: body.nextServiceDueAt ?? null,
      odometerMi: body.odometerMi ?? null,
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
