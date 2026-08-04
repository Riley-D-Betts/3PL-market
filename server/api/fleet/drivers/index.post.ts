export default defineEventHandler(async (event) => {
  const { company } = await requireCarrierCompany(event)
  const body = await readValidatedBody(event, driverCreateSchema.parse)
  const passwordHash = await hashUserPassword(body.password)

  const homeBase = body.homeBaseCity && body.homeBaseState
    ? await geocodeCityState(body.homeBaseCity, body.homeBaseState)
    : null

  try {
    const [driver] = await db.insert(users).values({
      email: body.email,
      passwordHash,
      name: body.name,
      phone: body.phone ?? null,
      role: 'driver',
      companyId: company.id,
      homeBaseCity: body.homeBaseCity ?? null,
      homeBaseState: body.homeBaseState ?? null,
      homeBaseLat: homeBase?.lat ?? null,
      homeBaseLng: homeBase?.lng ?? null,
    }).returning()
    setResponseStatus(event, 201)
    return { driver: toPublicUser(driver!) }
  }
  catch (err) {
    if (isUniqueViolation(err)) {
      throw createError({ statusCode: 409, statusMessage: 'An account with this email already exists' })
    }
    throw err
  }
})
