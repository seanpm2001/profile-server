/** ***************************************************************
* Copyright 2020 Advanced Distributed Learning (ADL)
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
**************************************************************** */
const profileModel = require('../ODM/models').profile;
const profileVersionModel = require('../ODM/models').profileVersion;
const organizationModel = require('../ODM/models').organization;
const createIRI = require('../utils/createIRI');
const langmaps = require('../utils/langmaps');
const responses = require('../reponseTypes/responses');

const mongoSanitize = require('mongo-sanitize');

const createVersionObject = require('../utils/createVersionObject');
const { validationError, notFoundError } = require('../errorTypes/errors');
const authorizationError = require('../errorTypes/authorizationError');
const models = require('../ODM/models');

/**
 * Adds a new profile to the system by creating a new profile and profile
 * version.
 * @param {uuid} organizationUuid The organization / working group that created this profile
 * @param {Object} profile The profile to be saved
 */
async function addNewProfile(organizationUuid, profile) {
    let newProfile;
    try {
        const organization = await organizationModel.findByUuid(organizationUuid);

        if (!organization) {
            throw new Error('That organization cannot be found for this profile.');
        }

        newProfile = new profileModel();
        newProfile.organization = organization._id;
        if (!profile.iri) {
            newProfile.iri = createIRI.profile(newProfile.uuid);
        } else {
            newProfile.iri = profile.iri;
        }

        const profileVersion = new profileVersionModel();
        Object.assign(profileVersion, profile);
        profileVersion.organization = organization._id;
        profileVersion.parentProfile = newProfile._id;
        profileVersion.iri = createIRI.profileVersion(newProfile.iri, profileVersion.version);
        profileVersion.state = 'draft';

        newProfile.currentDraftVersion = profileVersion._id;

        await newProfile.save();
        await profileVersion.save();
    } catch (err) {
        throw new Error(err);
    }

    return newProfile;
}

exports.addNewProfile = addNewProfile;

/**
 * Returns the root profile from the database.
 * @param {uuid} profileuuid The uuid of the profile
 */
async function getProfileFromDB(profileuuid) {
    return profileModel.findByUuid(profileuuid)
        .populate({
            path: 'versions',
            select: 'uuid iri name version state isShallowVersion',
            populate: { path: 'organization', select: 'uuid name' },
        }).populate('organization')
        .populate('currentPublishedVersion');
}

/**
 * Retrieves the profile in the system associated with the provided
 * profile uuid. Expects req.params.profile to contain the uuid.
 * Sends a JSON response back.
 *
 * @param {object} req express request object
 * @param {object} res express response object
 */
exports.getProfile = async function (req, res) {
    let profile;
    try {
        profile = await getProfileFromDB(req.params.profile);

        if (!profile) {
            return res.status(404).send({
                success: false,
                message: 'No profile found for this uuid.',
            });
        }
    } catch (err) {
        console.error(err);
        return res.status(500).send({
            success: false,
            message: err.message,
        });
    }

    res.send({
        success: true,
        profile: profile,
    });
};

/**
 * Used by the UI to retrieve the requested profile version, the root profile
 * and organization from just the uuid. The incoming uuid might be of a
 * root profile, or a version of a profile.
 *
 * req.params.profile contains the uuid of a profile
 *
 * returns the requested profile version (or current published version if the uuid
 * passed in was a root profile), the root profile and the organization.
 */
exports.resolveProfile = async function (req, res) {
    let profile;
    let profileVersion;
    let organization;
    try {
        profile = await getProfileFromDB(req.params.profile);

        if (!profile) {
            profileVersion = await profileVersionModel.findByUuid(req.params.profile)
                .populate({ path: 'parentProfile', select: 'uuid' })
                .populate({ path: 'organization', select: 'uuid name' });

            if (profileVersion) {
                profile = await getProfileFromDB(profileVersion.parentProfile.uuid);
            }
        } else {
            profileVersion = await profileVersionModel.findByUuid(profile.currentPublishedVersion.uuid)
                .populate({ path: 'parentProfile', select: 'uuid' })
                .populate({ path: 'organization', select: 'uuid name' });
        }

        if (!profile) {
            return res.status(404).send({
                success: false,
                message: 'No profile found for this uuid.',
            });
        }

        organization = await organizationModel.findByUuid(profile.organization.uuid);
    } catch (err) {
        console.error(err);
        return res.status(500).send({
            success: false,
            message: err.message,
        });
    }

    res.send({
        success: true,
        profile,
        profileVersion,
        organization,
    });
};

/**
 * Responds to server requests for profiles. If a query string param of 'iri'
 * was provided it will return the requested profile, otherwise it will return
 * and array of metadata about all published profiles.
 *
 * @param {*} req express request object
 * @param {*} res express response object
 * @param {*} next express next function
 */
exports.getPublishedProfiles = async function (req, res, next) {
    const iri = mongoSanitize(req.query.iri);
    if (!iri) return exports.getAllPublishedProfiles(req, res, next);

    let prof = await profileModel.findOne({ iri: iri });
    if (!prof) prof = await profileVersionModel.findOne({ iri: iri, state: 'published' });
    if (!prof) return next(new notFoundError('Profile not found'));

    req.profile = await exports.getProfilePopulated(prof.uuid);

    exports.exportProfile(req, res, next);
};

/**
 * Responds to server requests with metadata about all published profiles.
 * Can accept 'workinggroup', 'limit', and 'page' query params.
 *
 * @param {*} req express request object
 * @param {*} res express response object
 * @param {*} next express next function
 */
exports.getAllPublishedProfiles = async function (req, res, next) {
    const settings = require('../settings');
    try {
        const wg = mongoSanitize(req.query.workinggroup);
        const limit = parseInt(mongoSanitize(req.query.limit) || settings.QUERY_RESULT_LIMIT, 10);
        const page = mongoSanitize(req.query.page) || 1;
        const skip = (page - 1) * limit;
        const query = { currentPublishedVersion: { $exists: true } };

        if (wg) {
            const wgmodel = await organizationModel.findOne({ uuid: wg });
            if (wgmodel && wgmodel._id) query.organization = wgmodel._id;
            else {
                // if we didn't find a working group, just return an empty array
                return res.send({
                    success: true,
                    profiles: [],
                });
            }
        }

        const allprofiles = await profileModel
            .find(query)
            .limit(limit)
            .skip(skip)
            .populate({ path: 'currentPublishedVersion' })
            .exec();

        const profilemeta = await Promise.all(allprofiles.map(async profile => profile.currentPublishedVersion.getMetadata()));
        // const profilemeta = allprofiles;
        return res.send({
            success: true,
            metadata: profilemeta,
        });
    } catch (e) {
        return next(e);
    }
};

/**
 * Creates a profile based on the body of the request. Requires a URL
 * param of 'org' containing the uuid of the organization/working group
 * creating this profile.
 *
 * @param {*} req express request object
 * @param {*} res express response object
 */
exports.createProfile = async function (req, res) {
    let profile;
    try {
        profile = await addNewProfile(req.params.org, req.body);
    } catch (err) {
        console.error(err);
        return res.status(500).send({
            success: false,
            message: err.message,
        });
    }

    res.send({
        success: true,
        profile: profile,
    });
};

/**
 * Updates a profile based on the body of the request
 * @param {*} req express request object
 * @param {*} res express response object
 */
exports.updateProfile = async function (req, res) {
    let profile;
    try {
        req.body.updatedOn = new Date();
        profile = await profileModel.findOneAndUpdate(mongoSanitize({ uuid: req.body.uuid }), mongoSanitize(req.body), { new: true });

        if (!profile) {
            res.status(404).send({
                success: false,
                message: 'A profile could not be found for this uuid.',
            });
        }
    } catch (err) {
        console.error(err);
        return res.status(500).send({
            success: false,
            message: err.message,
        });
    }

    res.send({
        success: true,
        profile: profile,
    });
};

/**
 * Publishes the profile version associated with the uuid provided
 * in the url param 'profile'
 * Responds with a JSON object containing the newly published profile
 * version ('profile') and the root profile ('parentProfile')
 * @param {*} req express request object
 * @param {*} res express response object
 * @param {*} next express next function
 */
exports.publishProfile = async function (req, res, next) {
    let profile;
    let parentProfile;

    try {
        profile = await profileVersionModel.findByUuid(req.params.profile).populate('parentProfile');
        await profile.publish(req.user);
        parentProfile = profile.parentProfile;
    } catch (err) {
        console.log(err);
        next(err);
    }

    res.send({
        success: true,
        profile,
        parentProfile,
    });
};

/**
 * Deletes a profile draft. Only drafts can be deleted. And the
 * provided api key must be of the organization that owns the profile.
 *
 * @param {*} req express request object
 * @param {*} res express response object
 * @param {*} next express next function
 */
exports.deleteProfile = async function (req, res, next) {
    let meta;
    try {
        const profile = req.profile;
        if (req.validationScope === 'public') return res.status(401).send(responses.unauthorized('Not Authorized'));
        if (profile.state !== 'draft') return res.status(405).send(responses.notAllowed('Not Allowed: Only drafts can be deleted.'));

        meta = await profile.getMetadata();

        await profile.deleteDraft();
    } catch (err) {
        return next(err);
    }

    res.send(responses.metadata(true, meta));
};

/**
 * Imports the profile (jsonld) from the body of the request and
 * publishes it.
 * @param {*} req express request object
 * @param {*} res express response object
 * @param {*} next express next function
 */
exports.importProfile = async function (req, res, next) {
    const profileLayer = require('../controllers/importProfile/ProfileLayer').ProfileLayer;
    const profileDocument = req.body.profile;
    const published = req.body.status !== 'draft';
    let profileModel;
    try {
        const profileImporter = new profileLayer(req.organization, profileDocument, published);
        profileModel = await (await (await (await profileImporter
            .scanProfileLayer())
            .scanVersionLayer())
            .scanProfileComponentLayer())
            .save();

        await profileModel
            .populate('currentPublishedVersion')
            .populate('currentDraftVersion')
            .execPopulate();

        const metadata = published
            ? await profileModel.currentPublishedVersion.getMetadata()
            : await profileModel.currentDraftVersion.getMetadata();

        return res.send(
            responses.profileImport(
                true,
                metadata,
            ),
        );
    } catch (err) {
        return next(err);
    }
};

/**
 * Converts the internal rep of a profil into the spec define xapi profile jsonld format
 * @param {object} profile the profile from the system to be converted to xapi profile format
 */
exports.profileToJSONLD = async function (profile) {
    const concepts = await Promise.all(profile.concepts.map(c => c.export(profile.iri)));
    const templates = await Promise.all(profile.templates.map(t => t.export(profile.iri)));
    const patterns = await Promise.all(profile.patterns.map(p => p.export(profile.iri)));

    const exportedProfile = {
        id: profile.parentProfile.iri,
        '@context': 'https://w3id.org/xapi/profiles/context',
        type: 'Profile',
        conformsTo: 'https://w3id.org/xapi/profiles#1.0',
        prefLabel: langmaps.prefLabel(profile.name, profile.translations),
        definition: langmaps.definition(profile.description, profile.translations),
        seeAlso: profile.moreInformation,
        versions: createVersionObject(profile.parentProfile.versions),
        author: { type: 'Organization', name: profile.organization.name, url: profile.organization.collaborationLink },
        concepts: (concepts && concepts.length) ? concepts : undefined,
        templates: (templates && templates.length) ? templates : undefined,
        patterns: (patterns && patterns.length) ? patterns : undefined,
    };

    return exportedProfile;
};

/**
 * Responds to requests to get an xapi profile
 * @param {*} req express request object
 * @param {*} res express response object
 * @param {*} next express next function
 */
exports.exportProfile = async function (req, res, next) {
    const profile = req.profile;
    if (profile.state === 'draft' && req.validationScope === 'public') return next(new notFoundError('Profile not found'));

    const exportedProfile = await exports.profileToJSONLD(profile);

    res.header('Last-Modified', profile.updatedOn);
    res.json(exportedProfile);
};

/**
 * Responds to requests to get metadata about a specified profile
 * @param {*} req express request object
 * @param {*} res express response object
 * @param {*} next express next function
 */
exports.getMetadata = async function (req, res, next) {
    try {
        if (req.validationScope === 'public') return next(new authorizationError('Not Authorized'));
        res.header('Last-Modified', req.profile.updatedOn);
        res.send(responses.metadata(true, await req.profile.getMetadata()));
    } catch (e) {
        next(e);
    }
};

/**
 * Responds to requests to update a profile's status (publish or request verification).
 * @param {*} req express request object
 * @param {*} res express response object
 * @param {*} next express next function
 */
exports.updateStatus = async function (req, res, next) {
    try {
        if (req.validationScope === 'public') return next(new authorizationError('Not Authorized'));
        if (!req.body) return next(new validationError('The body of the request did not contain a status'));

        const profile = req.profile;
        const statusreq = mongoSanitize(req.body);

        if (statusreq.verificationRequest && !(profile.verificationRequest || profile.isVerified)) {
            profile.verificationRequest = statusreq.verificationRequest;
            profile.updatedOn = Date.now();
        }
        if (statusreq.published && profile.state === 'draft') {
            profile.publish(req.user);
        }
        profile.save();
        res.send(responses.status(true, (await profile.getMetadata()).status));
    } catch (e) {
        next(e);
    }
};

/**
 * Runs profile validation on the provided profile. Can be used as route
 * middleware - passing true will cause the function to call next()
 * @param {*} asMiddleware indicates if this function should call the express next function
 */
exports.validateProfile = function (asMiddleware) {
    return function (req, res, next) {
        const profileSchema = require('../profileValidator/schemas/profile');
        const concept = require('../profileValidator/schemas/concept');
        const document = require('../profileValidator/schemas/document');
        const extension = require('../profileValidator/schemas/extension');
        const validator = require('../profileValidator/validator');

        let profileDocument = req.body;
        if (asMiddleware) profileDocument = req.body.profile;
        if (!profileDocument) throw new validationError('Profile document missing.');

        const valid = validator.validate(profileDocument, profileSchema);

        // got errors.. try for better errors, then send
        if (valid.errors.length) {
            let valid2;
            for (const i in valid.errors) {
                if (valid.errors[i].name === 'oneOf') {
                    const ins = valid.errors[i].instance;
                    if (ins.type === 'ResultExtension' || ins.type === 'ContextExtension' || ins.type === 'ActivityExtension') {
                        valid2 = validator.validate(ins, extension);
                    }

                    if (ins.type === 'Verb' || ins.type === 'ActivityType' || ins.type === 'AttachmentUsageType') {
                        valid2 = validator.validate(ins, concept);
                    }

                    if (ins.type === 'StateResource' || ins.type === 'AgentProfileResource' || ins.type === 'ActivityProfileResource') {
                        valid2 = validator.validate(ins, document);
                    }
                }
            }
            if (valid2 && valid2.errors.length) {
                valid.errors.push(...valid2.errors);
            }

            return next(new validationError(
                ['Errors in the profile: ' + valid.errors.length, ...valid.errors.map(i => i.stack)].join('\n'),
            ));
        }

        if (asMiddleware) {
            req.profileValidationSuccess = true;
            next();
        } else {
            return res.send(responses.validation(true, 'Validation successful.'));
        }
    };
};

/**
 * Fully populates the profile
 * @param {uuid} profileUUID the uuid of the profile
 */
exports.getProfilePopulated = async function (profileUUID) {
    let profile = await profileVersionModel
        .findByUuid(profileUUID);

    if (!profile) {
        profile = await profileModel
            .findByUuid(profileUUID)
            .populate({
                path: 'currentPublishedVersion',
            });
        profile = profile.currentPublishedVersion;

        if (!profile) {
            return null;
        }
    }

    await profile
        .populate({ path: 'organization' })
        .populate({
            path: 'parentProfile',
            populate: {
                path: 'versions',
                match: { version: { $lte: profile.version } },
                options: {
                    sort: { createdOn: -1 },
                },
                populate: {
                    path: 'wasRevisionOf',
                },
            },
        })
        .populate({
            path: 'concepts',
            populate: [
                { path: 'parentProfile', select: 'uuid iri' },
                { path: 'recommendedTerms' },
                { path: 'similarTerms.concept' },
            ],
        })
        .populate({ path: 'templates' })
        .populate({ path: 'patterns' })
        .execPopulate();
    return profile;
};

exports.middleware = {
    /**
     * Middleware that takes the profile uuid provided in the url and attaches
     * the fully populated profile to the req object as 'req.profile'
     * @param {*} req express request object
     * @param {*} res express response object
     * @param {*} next express next function
     */
    populateProfile: async function (req, res, next) {
        try {
            const profileUUID = req.params.profile;
            const profile = await exports.getProfilePopulated(profileUUID);
            // test if the requested resource is a draft but the key isn't from the profile's working group
            if (!profile) {
                throw new notFoundError(`There was no profile found with uuid ${req.params.profile}`);
            }
            req.profile = profile;
        } catch (err) {
            return next(err);
        }

        next();
    },
};
